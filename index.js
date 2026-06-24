// ============================================================================
// KRIX ULTRA v7.2 – ENTERPRISE EDITION (FINAL PRODUCTION AUDIT v5)
// ============================================================================
import express from 'express';
import fs from 'fs';
import pino from 'pino';
import multer from 'multer';
import NodeCache from 'node-cache';
import pLimit from 'p-limit';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { makeWASocket, useMultiFileAuthState, delay, DisconnectReason,
         fetchLatestBaileysVersion, makeCacheableSignalKeyStore,
         Browsers } from '@whiskeysockets/baileys';

// ============================================================================
// 1. CONFIGURATION
// ============================================================================
const CONFIG = {
    PORT: process.env.PORT || 20023,
    SESSION_DIR: './auth_info',
    LOG_FILE: './logs/wa.log',
    BLACKLIST_THRESHOLD: 3,
    BLACKLIST_RESET_MS: 30000,
    MAX_RETRY_QUEUE: 500,
    DEFAULT_INTERVAL_SECONDS: 15,
    MIN_INTERVAL_SECONDS: 5,
    MAX_INTERVAL_SECONDS: 300,
    CONNECT_TIMEOUT_MS: 60000,
    DEFAULT_QUERY_TIMEOUT_MS: 60000,
    KEEPALIVE_INTERVAL_MS: 10000,
    RETRY_REQUEST_DELAY_MS: 1000,
    MAX_MS_RECONNECT_WAIT: 5000,
    RECONNECT_BASE_DELAY_MS: 3000,
    RECONNECT_MAX_DELAY_MS: 120000,
    RATE_LIMIT_COOLDOWN_MS: 60000,
    CONSECUTIVE_ERROR_THRESHOLD: 3,
    MAX_LOGS: 200,
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    CACHE_TTL_SECONDS: 3600,
    STALL_TIMEOUT_MS: 600000,
    HEARTBEAT_INTERVAL_MS: 10000,
    // Presence interval removed – not needed
    BATCH_SIZE: 10,
    MAX_RETRIES_SEND: 10,
    GROUP_METADATA_CONCURRENCY: 5,
    GC_INTERVAL_MS: 60000,
    MAX_CACHE_KEYS: 5000,
    CSRF_SECRET: process.env.CSRF_SECRET || 'change-this-secret-in-production',
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
    RATE_LIMIT_MAX: 100,
    CSRF_TTL: 3600000,
    STORE_SAVE_INTERVAL_MS: 300000,          // 5 minutes instead of 30s
    MAX_MESSAGES_PER_CHAT: 1000               // 1000 messages per chat limit
};

// ============================================================================
// 2. LOGGER
// ============================================================================
fs.mkdirSync('./logs', { recursive: true });

const logger = pino({
    level: 'info',
    transport: {
        targets: [
            { target: 'pino/file', options: { destination: CONFIG.LOG_FILE, mkdir: true, sync: false } },
            ...(process.env.NODE_ENV !== 'production'
                ? [{ target: 'pino-pretty', options: { colorize: true } }]
                : [])
        ]
    }
});

class LogBuffer {
    constructor(max = CONFIG.MAX_LOGS) {
        this.max = max;
        this.buffer = [];
    }
    add(entry) {
        this.buffer.unshift(entry);
        if (this.buffer.length > this.max) this.buffer.pop();
    }
    get() { return this.buffer; }
    clear() { this.buffer = []; }
}
const logBuffer = new LogBuffer();

const info = (msg, type = 'info') => {
    const safeType = type === 'success' ? 'info' : type;
    const timestamp = new Date().toLocaleTimeString();
    logBuffer.add({ timestamp, message: msg, type });
    logger[safeType](msg);
};

// ============================================================================
// 3. INPUT SANITIZATION
// ============================================================================
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================================
// 4. CSRF TOKEN HANDLING
// ============================================================================
const csrfTokens = new Map();
function generateToken(sessionId) {
    const token = crypto.randomBytes(32).toString('hex');
    csrfTokens.set(sessionId, { token, createdAt: Date.now() });
    setTimeout(() => {
        const entry = csrfTokens.get(sessionId);
        if (entry && entry.token === token) csrfTokens.delete(sessionId);
    }, CONFIG.CSRF_TTL).unref();
    return token;
}
function validateToken(sessionId, token) {
    const entry = csrfTokens.get(sessionId);
    if (!entry) return false;
    if (entry.token !== token) return false;
    if (Date.now() - entry.createdAt > CONFIG.CSRF_TTL) {
        csrfTokens.delete(sessionId);
        return false;
    }
    return true;
}

// ============================================================================
// 5. BLACKLIST MANAGER
// ============================================================================
class BlacklistManager {
    constructor() {
        this.errorCounts = new Map();
        this.createdAt = new Map();
    }
    markFail(target) {
        const count = (this.errorCounts.get(target) || 0) + 1;
        this.errorCounts.set(target, count);
        if (!this.createdAt.has(target)) this.createdAt.set(target, Date.now());
        const thresholdReached = count >= CONFIG.BLACKLIST_THRESHOLD;
        if (thresholdReached) info(`[BLACKLIST] ${target.split('@')[0]} blacklisted (${count} errors)`, 'warn');
        return thresholdReached;
    }
    clearSuccess(target) { this.errorCounts.delete(target); this.createdAt.delete(target); }
    isBlacklisted(target) { return (this.errorCounts.get(target) || 0) >= CONFIG.BLACKLIST_THRESHOLD; }
    clearAll() { this.errorCounts.clear(); this.createdAt.clear(); info('[BLACKLIST] All targets cleared', 'info'); }
    autoClean() {
        const now = Date.now();
        for (const [target, createdAt] of this.createdAt) {
            if (now - createdAt > CONFIG.BLACKLIST_RESET_MS) {
                this.errorCounts.delete(target);
                this.createdAt.delete(target);
                info(`[AUTO-CLEAR] ${target.split('@')[0]}`, 'info');
            }
        }
    }
    get size() { return this.errorCounts.size; }
}
const blacklistManager = new BlacklistManager();

// ============================================================================
// 6. APP STATE
// ============================================================================
class AppState {
    constructor() {
        this.targets = [];
        this.messages = [];
        this.haterName = '';
        this.intervalTime = 15;
        this.loopActive = false;
        this.loopRunning = false;
        this.totalSent = 0;
        this.totalFailed = 0;
        this.totalErrors = 0;
        this.messageCount = 0;
        this.cycleCount = 0;
        this.crashCount = 0;
        this.forcedClearCount = 0;
        this.currentMsgIndex = 0;
        this.currentTargetIndex = 0;
        this.lastActivityTime = Date.now();
        this.lastSendTime = Date.now();
        this.sessionStart = Date.now();
        this.tempBlocked = false;
    }
    reset(targets, messages, haterName, intervalTime) {
        this.targets = targets;
        this.messages = messages;
        this.haterName = haterName;
        this.intervalTime = intervalTime;
        this.loopActive = false;
        this.loopRunning = false;
        this.totalSent = 0;
        this.totalFailed = 0;
        this.totalErrors = 0;
        this.messageCount = 0;
        this.cycleCount = 0;
        this.crashCount = 0;
        this.forcedClearCount = 0;
        this.currentMsgIndex = 0;
        this.currentTargetIndex = 0;
        this.lastActivityTime = Date.now();
        this.lastSendTime = Date.now();
        this.sessionStart = Date.now();
        this.tempBlocked = false;
    }
}
const appState = new AppState();

// ============================================================================
// 7. CACHES (NodeCache TTL only – no flushAll intervals)
// ============================================================================
const msgRetryCounterCache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL_SECONDS, checkperiod: 120, maxKeys: CONFIG.MAX_CACHE_KEYS });
const groupMetadataCache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL_SECONDS, checkperiod: 120, maxKeys: CONFIG.MAX_CACHE_KEYS });
const contactCache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL_SECONDS, checkperiod: 120, maxKeys: CONFIG.MAX_CACHE_KEYS });
const chatCache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL_SECONDS, checkperiod: 120, maxKeys: CONFIG.MAX_CACHE_KEYS });

// ============================================================================
// 8. SIMPLE STORE with per-chat message limit (1000 max)
// ============================================================================
const STORE_FILE = './store.json';
class SimpleStore {
    constructor() {
        this.data = {};
        this._ev = null;
    }
    bind(ev) {
        this._ev = ev;
        ev.on('messages.upsert', this._onMessagesUpsert.bind(this));
    }
    unbind() {
        if (this._ev) {
            this._ev.removeAllListeners('messages.upsert');
            this._ev = null;
        }
    }
    _onMessagesUpsert({ messages }) {
        messages.forEach(m => {
            const key = m.key;
            const jid = key.remoteJid;
            if (!this.data[jid]) this.data[jid] = {};
            // Limit per chat to MAX_MESSAGES_PER_CHAT (1000)
            const chatMessages = this.data[jid];
            const messageKeys = Object.keys(chatMessages);
            if (messageKeys.length >= CONFIG.MAX_MESSAGES_PER_CHAT) {
                // Remove oldest messages (first 10% of limit)
                const toRemove = Math.ceil(CONFIG.MAX_MESSAGES_PER_CHAT * 0.1);
                for (let i = 0; i < toRemove && i < messageKeys.length; i++) {
                    delete chatMessages[messageKeys[i]];
                }
            }
            chatMessages[key.id] = m;
        });
    }
    loadMessage(jid, id) {
        if (this.data[jid] && this.data[jid][id]) return this.data[jid][id];
        return null;
    }
    writeToFile(filePath) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(this.data));
        } catch (e) { info(`[STORE] Write error: ${e.message}`, 'error'); }
    }
    readFromFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.data = JSON.parse(content);
        } catch (e) { throw e; }
    }
}
const store = new SimpleStore();
if (fs.existsSync(STORE_FILE)) {
    try {
        store.readFromFile(STORE_FILE);
        info('[STORE] Restored from file', 'info');
    } catch (e) {
        info(`[STORE] Failed to restore: ${e.message}`, 'error');
        try { fs.unlinkSync(STORE_FILE); } catch (unlinkErr) {}
    }
}
// Save store every 5 minutes (300000 ms) instead of 30 seconds
setInterval(() => {
    try { store.writeToFile(STORE_FILE); } catch (e) {
        info(`[STORE] Write error: ${e.message}`, 'error');
    }
}, CONFIG.STORE_SAVE_INTERVAL_MS).unref();

// ============================================================================
// 9. CONNECTION MANAGER
// ============================================================================
let cachedVersion = null;
class ConnectionManager {
    constructor() {
        this.sock = null;
        this.store = store;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this._onConnected = null;
        this._onDisconnected = null;
    }
    setCallbacks({ onConnected, onDisconnected }) {
        this._onConnected = onConnected;
        this._onDisconnected = onDisconnected;
    }
    async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;
        info('📱 Connecting to WhatsApp...', 'info');
        try {
            if (!fs.existsSync(CONFIG.SESSION_DIR)) fs.mkdirSync(CONFIG.SESSION_DIR, { recursive: true });
            if (!cachedVersion) cachedVersion = await fetchLatestBaileysVersion();
            const { version } = cachedVersion;
            const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_DIR);
            if (this.sock) {
                try { if (this.store.unbind) this.store.unbind(); } catch (e) {}
                try { this.sock.ws?.close(); this.sock.ev?.removeAllListeners(); } catch (e) {}
                this.sock = null;
            }
            this.sock = makeWASocket({
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
                },
                version,
                connectTimeoutMs: CONFIG.CONNECT_TIMEOUT_MS,
                defaultQueryTimeoutMs: CONFIG.DEFAULT_QUERY_TIMEOUT_MS,
                keepAliveIntervalMs: CONFIG.KEEPALIVE_INTERVAL_MS,
                emitOwnEvents: false,
                retryRequestDelayMs: CONFIG.RETRY_REQUEST_DELAY_MS,
                maxMsReconnectWait: CONFIG.MAX_MS_RECONNECT_WAIT,
                generateHighQualityLinkPreview: false,
                patchMessageBeforeSending: (msg) => msg,
                getMessage: async (key) => ({
                    conversation: (await this.store.loadMessage(key.remoteJid, key.id))?.message?.conversation || ''
                }),
                msgRetryCounterCache,
                markOnlineOnConnect: false,
                shouldIgnoreJid: () => false
            });
            this.store.bind(this.sock.ev);
            this._attachEvents(saveCreds);
            this.isConnecting = false;
        } catch (error) {
            this.isConnecting = false;
            info(`❌ Connection setup error: ${error.message}`, 'error');
            this._scheduleReconnect(CONFIG.RECONNECT_BASE_DELAY_MS);
        }
    }
    _attachEvents(saveCreds) {
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                info('✅ CONNECTED!', 'success');
                if (this._onConnected) this._onConnected();
            }
            if (connection === 'close') {
                this.isConnecting = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                info(`🔌 Disconnected (statusCode: ${statusCode})`, 'warn');
                if (statusCode === DisconnectReason.loggedOut) {
                    info('🚫 Logged out – clearing session', 'error');
                    try { fs.rmSync(CONFIG.SESSION_DIR, { recursive: true, force: true }); } catch (e) {}
                    this._scheduleReconnect(5000);
                } else {
                    this.reconnectAttempts++;
                    const delayMs = Math.min(CONFIG.RECONNECT_MAX_DELAY_MS,
                        CONFIG.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1) + Math.random() * 2000);
                    info(`🔄 Reconnecting in ${Math.round(delayMs / 1000)}s (attempt ${this.reconnectAttempts})`, 'info');
                    this._scheduleReconnect(delayMs);
                }
                if (this._onDisconnected) this._onDisconnected();
            }
        });
        this.sock.ev.on('creds.update', async () => { try { await saveCreds(); } catch (e) {} });
        this.sock.ev.on('contacts.update', (updates) => {
            updates.forEach(u => { if (u.id) contactCache.set(u.id, u); });
        });
        this.sock.ev.on('chats.update', (updates) => {
            updates.forEach(u => { if (u.id) chatCache.set(u.id, u); });
        });
    }
    _scheduleReconnect(waitMs) {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.isConnecting) this.connect();
        }, waitMs);
    }
    disconnect() {
        if (this.sock) {
            try { if (this.store.unbind) this.store.unbind(); this.sock.ws?.close(); this.sock.ev?.removeAllListeners(); } catch (e) {}
            this.sock = null;
        }
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        this.isConnecting = false;
    }
    getSocket() { return this.sock; }
}
const connectionManager = new ConnectionManager();

// ============================================================================
// 10. GROUP NAME FETCHER
// ============================================================================
const groupMetadataLimit = pLimit(CONFIG.GROUP_METADATA_CONCURRENCY);
async function fetchGroupName(sock, jid) {
    const cached = groupMetadataCache.get(jid);
    if (cached) return cached;
    try {
        const metadata = await sock.groupMetadata(jid);
        const name = metadata.subject || 'Unknown';
        groupMetadataCache.set(jid, name);
        return name;
    } catch (e) {
        info(`[GROUPS] Failed to fetch metadata for ${jid}: ${e.message}`, 'error');
        return 'Unknown';
    }
}
async function fetchAllGroupNames(sock, groupIds) {
    const tasks = groupIds.map(jid =>
        groupMetadataLimit(async () => {
            if (!groupMetadataCache.has(jid)) {
                try {
                    const metadata = await sock.groupMetadata(jid);
                    const name = metadata.subject || 'Unknown';
                    groupMetadataCache.set(jid, name);
                } catch (e) {
                    groupMetadataCache.set(jid, 'Unknown');
                }
            }
            return { id: jid, name: groupMetadataCache.get(jid) };
        })
    );
    return Promise.all(tasks);
}

// ============================================================================
// 11. SMART SENDER
// ============================================================================
class Sender {
    constructor() {
        this.consecutiveErrors = 0;
        this.isTempBlocked = false;
        this.blockEndTime = 0;
        this.retryQueue = [];
        this.tokens = 30;
        this.lastRefill = Date.now();
        this.bucketSize = 30;
        this.refillRate = 10;
    }
    async _getToken() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.bucketSize, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
        if (this.tokens < 1) {
            const waitMs = ((1 - this.tokens) * 1000) / this.refillRate;
            await delay(waitMs);
            this.tokens = 1;
        }
        this.tokens -= 1;
    }
    async send(target, message) {
        await this._getToken();
        if (this.isTempBlocked) {
            const waitTime = Math.max(0, this.blockEndTime - Date.now());
            if (waitTime > 0) {
                info(`[BLOCKED] Waiting ${Math.ceil(waitTime / 1000)}s...`, 'warn');
                appState.tempBlocked = true;
                await delay(waitTime);
                appState.tempBlocked = false;
                this.isTempBlocked = false;
            }
        }
        if (!target || !message) return false;
        if (blacklistManager.isBlacklisted(target)) return false;
        if (this.consecutiveErrors > CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
            const extra = Math.min(30000, this.consecutiveErrors * 2000);
            await delay(extra);
        }
        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES_SEND; attempt++) {
            try {
                const sock = connectionManager.getSocket();
                if (!sock?.user) { await delay(2000); continue; }
                await sock.sendMessage(target, { text: message });
                this.consecutiveErrors = 0;
                blacklistManager.clearSuccess(target);
                appState.totalSent++;
                appState.messageCount++;
                appState.lastActivityTime = Date.now();
                appState.lastSendTime = Date.now();
                if (appState.totalSent % 10 === 0) {
                    const display = target.includes('@g.us')
                        ? `Group:${groupMetadataCache.get(target) || target.split('@')[0].slice(-8)}`
                        : target.split('@')[0];
                    info(`📨 #${appState.totalSent} → ${display}`, 'success');
                }
                await delay(Math.random() * 500);
                return true;
            } catch (err) {
                appState.totalErrors++;
                const errMsg = err?.message || String(err);
                if (errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('too many')) {
                    this.consecutiveErrors++;
                    if (this.consecutiveErrors >= CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
                        this.isTempBlocked = true;
                        this.blockEndTime = Date.now() + CONFIG.RATE_LIMIT_COOLDOWN_MS;
                        appState.tempBlocked = true;
                        info(`⚠️ TEMPORARY BLOCK - ${CONFIG.RATE_LIMIT_COOLDOWN_MS / 1000}s cooldown`, 'error');
                        await delay(CONFIG.RATE_LIMIT_COOLDOWN_MS);
                        this.isTempBlocked = false;
                        appState.tempBlocked = false;
                        this.consecutiveErrors = 0;
                        continue;
                    }
                }
                info(`❌ Attempt ${attempt}/${CONFIG.MAX_RETRIES_SEND} for ${target.split('@')[0]}`, 'error');
                blacklistManager.markFail(target);
                if (attempt < CONFIG.MAX_RETRIES_SEND) {
                    const backoff = Math.min(10000, 2000 * attempt);
                    await delay(backoff);
                }
            }
        }
        appState.totalFailed++;
        if (this.retryQueue.length < CONFIG.MAX_RETRY_QUEUE) {
            this.retryQueue.push({ target, message, addedAt: Date.now() });
        }
        return false;
    }
    async processRetryQueue() {
        if (this.retryQueue.length === 0) return;
        const batch = this.retryQueue.splice(0, CONFIG.BATCH_SIZE);
        const promises = batch.map(({ target, message }) => this.send(target, message));
        await Promise.all(promises);
    }
    get queueSize() { return this.retryQueue.length; }
    reset() {
        this.consecutiveErrors = 0;
        this.isTempBlocked = false;
        this.blockEndTime = 0;
        this.retryQueue = [];
        this.tokens = this.bucketSize;
        this.lastRefill = Date.now();
    }
}
const sender = new Sender();

// ============================================================================
// 12. ATTACK ENGINE (removed presence interval)
// ============================================================================
class AttackEngine {
    constructor() {
        this._running = false;
        this._lock = false;
        this._heartbeatInterval = null;
        this._gcInterval = null;  // only GC interval kept (optional)
    }
    start() {
        if (this._lock) { info('[ENGINE] Already starting/running', 'info'); return; }
        this._lock = true;
        this._running = true;
        appState.loopActive = true;
        appState.loopRunning = true;
        appState.crashCount = 0;
        appState.lastActivityTime = Date.now();
        appState.lastSendTime = Date.now();
        appState.sessionStart = appState.sessionStart || Date.now();
        appState.totalSent = 0;
        appState.totalFailed = 0;
        appState.totalErrors = 0;
        appState.forcedClearCount = 0;
        info('🔥 INFINITE LOOP ENGAGED 🔥', 'success');
        this._startIntervals();
        this._runMainLoop().catch((err) => {
            info(`[ENGINE] Main loop crashed: ${err.message}`, 'error');
            this._running = false;
            appState.loopRunning = false;
            this._lock = false;
            this._cleanup();
            if (appState.loopActive) setTimeout(() => this.start(), 5000);
        });
    }
    async _runMainLoop() {
        while (appState.loopActive) {
            try {
                while (!connectionManager.getSocket()?.user && appState.loopActive) { await delay(3000); }
                if (!appState.loopActive) break;
                const { targets, messages, haterName, intervalTime } = appState;
                if (!messages?.length || !targets?.length) { await delay(1000); continue; }
                let targetIndex = -1;
                for (let i = 0; i < targets.length; i++) {
                    const idx = (appState.currentTargetIndex + i) % targets.length;
                    if (!blacklistManager.isBlacklisted(targets[idx])) { targetIndex = idx; break; }
                }
                if (targetIndex === -1) {
                    info('[CLEAR] All targets blacklisted – clearing', 'warn');
                    blacklistManager.clearAll();
                    appState.forcedClearCount++;
                    await delay(5000);
                    continue;
                }
                const fullMessage = `${haterName} ${messages[appState.currentMsgIndex % messages.length]}`;
                const target = targets[targetIndex];
                await sender.send(target, fullMessage);
                appState.currentTargetIndex = (targetIndex + 1) % targets.length;
                if (appState.currentTargetIndex === 0) {
                    appState.currentMsgIndex++;
                    appState.cycleCount++;
                    if (appState.cycleCount % 5 === 0) info(`📊 Cycle ${appState.cycleCount} | Sent:${appState.totalSent} | BL:${blacklistManager.size}`, 'info');
                }
                if (appState.loopActive && intervalTime > 0) await delay((intervalTime * 1000) + Math.random() * 1000);
                if (appState.cycleCount % 10 === 0 && appState.cycleCount > 0) await sender.processRetryQueue();
                appState.lastActivityTime = Date.now();
                appState.loopRunning = true;
            } catch (err) {
                appState.crashCount++;
                info(`⚠️ Loop iteration error #${appState.crashCount}: ${err.message}`, 'error');
                await delay(2000);
            }
        }
        this._running = false;
        appState.loopRunning = false;
        this._lock = false;
        this._cleanup();
        info('[ENGINE] Stopped', 'warn');
        if (appState.loopActive) { await delay(3000); if (appState.loopActive && !this._running) this.start(); }
    }
    _startIntervals() {
        // Cleanup any existing intervals first
        this._cleanup();
        this._heartbeatInterval = setInterval(() => {
            try {
                blacklistManager.autoClean();
                if (appState.loopActive && !appState.loopRunning && !this._running) { info('[FORCE] Loop dead – restarting', 'warn'); this.start(); }
            } catch (e) { info(`Heartbeat error: ${e.message}`, 'error'); }
        }, CONFIG.HEARTBEAT_INTERVAL_MS);
        // Presence update interval removed – not needed
        // Optional GC interval (if Node is run with --expose-gc)
        if (global.gc) {
            this._gcInterval = setInterval(() => { global.gc(); info('[GC] Garbage collection triggered', 'debug'); }, CONFIG.GC_INTERVAL_MS).unref();
        }
    }
    _cleanup() {
        if (this._heartbeatInterval) { clearInterval(this._heartbeatInterval); this._heartbeatInterval = null; }
        if (this._gcInterval) { clearInterval(this._gcInterval); this._gcInterval = null; }
    }
    stop() {
        appState.loopActive = false;
        appState.loopRunning = false;
        this._cleanup();
        this._running = false;
        this._lock = false;
        info('⛔ Loop stopped by user', 'warn');
    }
    get isRunning() { return this._running; }
}
const attackEngine = new AttackEngine();

// ============================================================================
// 13. EXPRESS APP
// ============================================================================
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
const apiLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
    max: CONFIG.RATE_LIMIT_MAX,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);
app.use('/pair', apiLimiter);
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(express.json({ limit: '1mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: CONFIG.MAX_FILE_SIZE } });
const formatNumber = (num) => { const cleaned = String(num).replace(/[^0-9]/g, ''); if (cleaned.length < 10) return ''; return cleaned; };
connectionManager.setCallbacks({
    onConnected: () => { if (appState.loopActive && !attackEngine.isRunning) { info('[RESUME] Starting loop after reconnect', 'info'); attackEngine.start(); } },
    onDisconnected: () => {}
});

// API Routes
app.get('/api/status', (req, res) => {
    const mem = process.memoryUsage();
    const uptimeSec = appState.sessionStart ? Math.floor((Date.now() - appState.sessionStart) / 1000) : 0;
    const cpuUsage = process.cpuUsage();
    res.json({
        connected: !!connectionManager.getSocket()?.user,
        active: appState.loopActive,
        running: appState.loopRunning,
        targets: appState.targets.length,
        messages: appState.messages?.length || 0,
        totalSent: appState.totalSent,
        totalFailed: appState.totalFailed,
        totalErrors: appState.totalErrors,
        blacklistCount: blacklistManager.size,
        retryQueueSize: sender.queueSize,
        uptime: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
        blocked: appState.tempBlocked,
        forcedClears: appState.forcedClearCount,
        cycleCount: appState.cycleCount,
        memory: {
            rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`
        },
        cpu: { user: cpuUsage.user, system: cpuUsage.system },
        cacheStats: {
            groupMetadata: groupMetadataCache.keys().length,
            contacts: contactCache.keys().length,
            chats: chatCache.keys().length
        }
    });
});
let logsCache = { data: null, timestamp: 0 };
app.get('/api/logs', (req, res) => {
    const now = Date.now();
    if (logsCache.data && now - logsCache.timestamp < 2000) return res.json(logsCache.data);
    const data = { logs: logBuffer.get(), connected: !!connectionManager.getSocket()?.user, active: appState.loopActive };
    logsCache = { data, timestamp: now };
    res.json(data);
});
app.get('/api/groups', async (req, res) => {
    try {
        const sock = connectionManager.getSocket();
        if (!sock?.user) return res.status(503).json({ error: 'WhatsApp not connected' });
        const groups = await sock.groupFetchAllParticipating();
        const groupIds = Object.keys(groups);
        const groupNames = await fetchAllGroupNames(sock, groupIds);
        const groupList = groupNames.map(({ id, name }) => ({ id, name: name || groups[id].subject || 'Unknown', participants: groups[id].participants?.length || 0 }));
        res.json({ groups: groupList, count: groupList.length });
    } catch (e) { info(`Group fetch error: ${e.message}`, 'error'); res.status(500).json({ error: e.message }); }
});
app.post('/pair', async (req, res) => {
    try {
        const phone = formatNumber(req.body.phone);
        if (!phone) return res.send('<h2>❌ Invalid phone number</h2><a href="/">BACK</a>');
        const sock = connectionManager.getSocket();
        if (!sock) return res.send('<h2>❌ Service starting...</h2><a href="/">BACK</a>');
        if (sock.user) return res.send('<h2>✅ Already connected!</h2><a href="/">BACK</a>');
        const code = await sock.requestPairingCode(phone);
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
        res.send(`<h1>📱 PAIRING CODE</h1><h2 style="font-size:3em;color:#ff00ff">${escapeHtml(formatted)}</h2><p>Open WhatsApp → Settings → Linked Devices → Link with Phone Number</p><a href="/">BACK</a>`);
    } catch (e) { info(`Pairing error: ${e.message}`, 'error'); res.send(`<h2>Error: ${escapeHtml(e.message)}</h2><a href="/">BACK</a>`); }
});
app.post('/attack', upload.single('msgFile'), async (req, res) => {
    try {
        const sessionId = req.ip;
        const token = req.body._csrf;
        if (!token || !validateToken(sessionId, token)) return res.status(403).send('<h2>❌ Invalid or expired CSRF token</h2><a href="/">BACK</a>');
        const sock = connectionManager.getSocket();
        if (!sock?.user) throw new Error('WhatsApp not connected!');
        const { numbers, groups, hater, delay: delayTime } = req.body;
        if (!req.file) throw new Error('No message file');
        const messages = req.file.buffer.toString('utf-8').split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (messages.length === 0) throw new Error('Message file is empty');
        let targets = [];
        if (numbers?.trim()) numbers.split('\n').forEach(n => {
            let c = n.trim().replace(/\s/g, '');
            if (c) {
                if (!c.includes('@')) { const cleaned = formatNumber(c); if (cleaned) { c = cleaned + '@s.whatsapp.net'; } else return; }
                targets.push(c.includes('@') ? c : c + '@s.whatsapp.net');
            }
        });
        if (groups?.trim()) groups.split('\n').forEach(g => {
            const c = g.trim().replace(/\s/g, '');
            if (c) targets.push(c.includes('@') ? c : c + '@g.us');
        });
        if (targets.length === 0) throw new Error('No targets provided!');
        attackEngine.stop();
        await new Promise(resolve => setTimeout(resolve, 1000));
        appState.reset(targets, messages, hater || 'krix', Math.max(5, parseInt(delayTime) || 15));
        sender.reset();
        blacklistManager.clearAll();
        info(`🚀 ATTACK STARTED | ${targets.length} targets | ${messages.length} messages | ${appState.intervalTime}s delay`, 'success');
        attackEngine.start();
        res.redirect('/');
    } catch (e) { res.send(`<h2>❌ Error: ${escapeHtml(e.message)}</h2><a href="/">BACK</a>`); }
});
app.post('/stop', (req, res) => {
    const sessionId = req.ip;
    const token = req.body._csrf;
    if (!token || !validateToken(sessionId, token)) return res.status(403).send('<h2>❌ Invalid or expired CSRF token</h2><a href="/">BACK</a>');
    attackEngine.stop();
    res.redirect('/');
});

// HTML Pages
app.get('/', (req, res) => {
    const sessionId = req.ip;
    const csrfToken = generateToken(sessionId);
    res.send(`<!DOCTYPE html><html><head><title>krix - ENTERPRISE</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0f;color:#00ff88;font-family:monospace;padding:20px}.container{max-width:800px;margin:0 auto}.header{text-align:center;padding:20px;border-bottom:2px solid #ff00ff;margin-bottom:20px}.header h1{color:#ff00ff;font-size:2em}.status-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}.card{background:#111;border:1px solid #333;padding:15px;text-align:center;border-radius:5px}.card-value{font-size:2em;font-weight:bold}.card-label{font-size:0.7em;color:#888;margin-top:5px}.green{color:#00ff88}.red{color:#ff4444}.neon{color:#ff00ff}.nav{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}.nav a,.nav button{background:linear-gradient(135deg,#ff00ff,#8800ee);color:white;padding:10px 20px;text-decoration:none;border:none;cursor:pointer;font-family:monospace;border-radius:5px}.stop-btn{background:linear-gradient(135deg,#ff4444,#880000)}.groups-btn{background:linear-gradient(135deg,#00ff88,#0088ff)}form{background:#111;padding:20px;border-radius:5px;margin-top:20px}input,textarea,select{width:100%;padding:10px;margin:10px 0;background:#222;border:1px solid #444;color:white;font-family:monospace}button{background:#00ff88;color:black;padding:10px 20px;border:none;cursor:pointer;font-weight:bold}</style></head><body><div class="container"><div class="header"><h1>🔥 krix ULTRA ENTERPRISE 🔥</h1><p>24/7 PRODUCTION • SECURE</p></div><div class="nav"><a href="/">DASHBOARD</a><a href="/pair">PAIR</a><a href="/attack-page">ATTACK</a><a href="/logs-page">LOGS</a><a href="/groups-page" class="groups-btn">📋 GROUPS</a><form action="/stop" method="post" style="margin:0;padding:0;display:inline"><input type="hidden" name="_csrf" value="${csrfToken}"><button type="submit" class="stop-btn" style="background:#ff4444;color:white">⛔ STOP</button></form></div><div class="status-grid"><div class="card"><div class="card-value green" id="conn">OFFLINE</div><div class="card-label">CONNECTION</div></div><div class="card"><div class="card-value neon" id="loop">IDLE</div><div class="card-label">LOOP</div></div><div class="card"><div class="card-value green" id="sent">0</div><div class="card-label">SENT</div></div><div class="card"><div class="card-value red" id="failed">0</div><div class="card-label">FAILED</div></div></div><form action="/attack" method="post" enctype="multipart/form-data"><input type="hidden" name="_csrf" value="${csrfToken}"><h3>⚡ START INFINITE ATTACK</h3><textarea name="numbers" placeholder="Phone numbers (one per line)&#10;919999999999&#10;918888888888" rows="3"></textarea><textarea name="groups" placeholder="Group IDs (one per line)&#10;123456789@g.us" rows="2"></textarea><input type="file" name="msgFile" accept=".txt" required><input type="text" name="hater" placeholder="Your Name" value="krix" required><input type="number" name="delay" value="15" min="5" step="1"><button type="submit">🔥 START INFINITE ATTACK 🔥</button></form></div><script>function refresh(){fetch('/api/status').then(r=>r.json()).then(d=>{document.getElementById('conn').textContent=d.connected?'ONLINE':'OFFLINE';document.getElementById('loop').textContent=d.running?'RUNNING':(d.active?'ACTIVE':'IDLE');document.getElementById('sent').textContent=d.totalSent||0;document.getElementById('failed').textContent=d.totalFailed||0}).catch(e=>{})}setInterval(refresh,2000);refresh();</script></body></html>`);
});
app.get('/pair', (req, res) => {
    const sessionId = req.ip;
    const csrfToken = generateToken(sessionId);
    res.send(`<!DOCTYPE html><html><head><title>Pair WhatsApp</title><style>body{background:#0a0a0f;color:#00ff88;font-family:monospace;padding:20px;text-align:center}</style></head><body><h1>🔗 PAIR WHATSAPP</h1><form action="/pair" method="post"><input type="hidden" name="_csrf" value="${csrfToken}"><input type="text" name="phone" placeholder="919999999999" required><button type="submit">GET CODE</button></form><a href="/">← BACK</a></body></html>`);
});
app.get('/attack-page', (req, res) => { res.redirect('/'); });
app.get('/groups-page', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Groups List</title><style>body{background:#0a0a0f;color:#00ff88;font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:8px;text-align:left}th{background:#111}a{color:#ff00ff}</style></head><body><h1>📋 MY GROUPS</h1><a href="/">← BACK</a><div id="groups"><p>Loading...</p></div><script>fetch('/api/groups').then(r=>r.json()).then(d=>{if(d.error){document.getElementById('groups').innerHTML='<p style="color:red">'+d.error+'</p>';return}let html='<table><tr><th>Group Name</th><th>UID</th><th>Members</th></tr>';d.groups.forEach(g=>{html+='<tr><td>'+g.name+'</td><td style="font-size:0.8em;color:#ff00ff">'+g.id+'</td><td>'+g.participants+'</td></tr>'});html+='</table><p>Total: '+d.count+' groups</p>';document.getElementById('groups').innerHTML=html}).catch(()=>{document.getElementById('groups').innerHTML='<p style="color:red">Failed to load</p>'});</script></body></html>`);
});
app.get('/logs-page', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Live Logs</title><style>body{background:#0a0a0f;color:#00ff88;font-family:monospace;padding:20px}pre{background:#000;padding:10px;overflow:auto;height:80vh}</style></head><body><h1>📋 LIVE LOGS</h1><a href="/">← BACK</a><pre id="logs">Loading...</pre><script>setInterval(()=>{fetch('/api/logs').then(r=>r.json()).then(d=>{document.getElementById('logs').innerHTML=d.logs.map(l=>'['+l.timestamp+'] '+l.message).join('\\n')})},2000);</script></body></html>`);
});

// ============================================================================
// 14. GRACEFUL SHUTDOWN
// ============================================================================
async function gracefulShutdown(signal) {
    info(`📴 ${signal} received – shutting down gracefully`, 'warn');
    attackEngine.stop();
    connectionManager.disconnect();
    try { store.writeToFile(STORE_FILE); } catch (e) {}
    await delay(500);
    process.exit(0);
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (err) => { info(`💀 UNCAUGHT EXCEPTION: ${err.message}`, 'error'); info('🔄 Restarting process in 5 seconds...', 'warn'); setTimeout(() => process.exit(1), 5000); });
process.on('unhandledRejection', (reason, promise) => { info(`💀 UNHANDLED REJECTION: ${reason?.message || reason}`, 'error'); });

// ============================================================================
// 15. START SERVER
// ============================================================================
connectionManager.connect();
app.listen(CONFIG.PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  🔥 krix ULTRA – ENTERPRISE EDITION (SECURED v5) 🔥              ║
║  ══════════════════════════════════════════════════════════════════║
║  ✅ All original features preserved                                ║
║  ✅ Per-chat message limit (1000 max)                             ║
║  ✅ Store save every 5 minutes                                     ║
║  ✅ Removed presence update interval                               ║
║  ✅ Removed flushAll intervals (NodeCache TTL)                    ║
║  ✅ Cleanup of intervals on engine start/stop                     ║
║  ✅ Crash‑proof infinite loop with heartbeat                       ║
║  ✅ PM2 friendly, 24/7 stable                                      ║
╚════════════════════════════════════════════════════════════════════╝
    `);
});
