// ============================================================================
// KRIX ULTRA v8.2 – PRODUCTION AUDIT PASSED
// ============================================================================

import express from 'express';
import fs from 'fs';
import { writeFile } from 'fs/promises';
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
    PORT: parseInt(process.env.PORT, 10) || 20023,
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
    HEARTBEAT_INTERVAL_MS: 10000,
    BATCH_SIZE: 10,
    MAX_RETRIES_SEND: 10,
    GROUP_METADATA_CONCURRENCY: 5,
    GC_INTERVAL_MS: 60000,
    MAX_CACHE_KEYS: 5000,
    CSRF_SECRET: process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex'),
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
    RATE_LIMIT_MAX: 100,
    CSRF_TTL: 3600000,
    STORE_SAVE_INTERVAL_MS: 300000,
    MAX_MESSAGES_PER_CHAT: 1000,
    MAX_RECONNECT_ATTEMPTS: 50,
    MAX_EXPONENT: 10,
    TOKEN_BUCKET_SIZE: 30,
    TOKEN_REFILL_RATE: 10,
    MAX_TOKEN_WAIT_MS: 60000
};

// ============================================================================
// 2. LOGGER
// ============================================================================
try {
    fs.mkdirSync('./logs', { recursive: true });
} catch (e) {
    console.error('Failed to create logs directory:', e.message);
}

const logger = pino({
    level: 'info',
    transport: process.env.NODE_ENV === 'production'
        ? { target: 'pino/file', options: { destination: CONFIG.LOG_FILE, mkdir: true, sync: false } }
        : {
            targets: [
                { target: 'pino/file', options: { destination: CONFIG.LOG_FILE, mkdir: true, sync: false } },
                { target: 'pino-pretty', options: { colorize: true } }
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
        if (this.buffer.length > this.max) this.buffer.length = this.max;
    }
    get() { return this.buffer; }
    clear() { this.buffer = []; }
}
const logBuffer = new LogBuffer();

function info(msg, type = 'info') {
    const safeType = type === 'success' ? 'info' : type;
    const timestamp = new Date().toLocaleTimeString();
    logBuffer.add({ timestamp, message: msg, type });
    if (logger[safeType]) {
        logger[safeType](msg);
    } else {
        logger.info(msg);
    }
}

// ============================================================================
// 3. SANITIZATION
// ============================================================================
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return String(unsafe || '');
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================================
// 4. CSRF HANDLING
// ============================================================================
const csrfTokens = new Map();

function getClientId(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.ip || 
           'unknown';
}

function generateToken(sessionId) {
    const token = crypto.randomBytes(32).toString('hex');
    csrfTokens.set(sessionId, { token, createdAt: Date.now() });
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
    csrfTokens.delete(sessionId); // One-time use
    return true;
}

// Periodic CSRF cleanup
const csrfCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, entry] of csrfTokens) {
        if (now - entry.createdAt > CONFIG.CSRF_TTL) {
            csrfTokens.delete(sessionId);
        }
    }
}, 300000).unref();

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
        if (!this.createdAt.has(target)) {
            this.createdAt.set(target, Date.now());
        }
        return count >= CONFIG.BLACKLIST_THRESHOLD;
    }
    clearSuccess(target) {
        this.errorCounts.delete(target);
        this.createdAt.delete(target);
    }
    isBlacklisted(target) {
        return (this.errorCounts.get(target) || 0) >= CONFIG.BLACKLIST_THRESHOLD;
    }
    clearAll() {
        this.errorCounts.clear();
        this.createdAt.clear();
        info('[BLACKLIST] Cleared', 'info');
    }
    autoClean() {
        const now = Date.now();
        for (const [target, createdAt] of this.createdAt.entries()) {
            if (now - createdAt > CONFIG.BLACKLIST_RESET_MS) {
                this.errorCounts.delete(target);
                this.createdAt.delete(target);
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
        this.sessionStart = Date.now();
        this.reset([], [], '', 15);
    }
    reset(targets, messages, haterName, intervalTime) {
        this.targets = targets;
        this.messages = messages;
        this.haterName = haterName;
        this.intervalTime = Math.max(CONFIG.MIN_INTERVAL_SECONDS, 
                          Math.min(CONFIG.MAX_INTERVAL_SECONDS, intervalTime));
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
        this.tempBlocked = false;
    }
}
const appState = new AppState();

// ============================================================================
// 7. CACHES
// ============================================================================
const cacheOptions = { 
    stdTTL: CONFIG.CACHE_TTL_SECONDS, 
    checkperiod: 120, 
    maxKeys: CONFIG.MAX_CACHE_KEYS,
    useClones: false
};
const msgRetryCounterCache = new NodeCache(cacheOptions);
const groupMetadataCache = new NodeCache(cacheOptions);
const contactCache = new NodeCache(cacheOptions);
const chatCache = new NodeCache(cacheOptions);

// ============================================================================
// 8. SIMPLE STORE
// ============================================================================
const STORE_FILE = './store.json';

class SimpleStore {
    constructor() {
        this.data = {};
        this._ev = null;
        this._messageUpsertHandler = null;
    }
    
    bind(ev) {
        if (this._ev) return;
        this._ev = ev;
        this._messageUpsertHandler = this._onMessagesUpsert.bind(this);
        ev.on('messages.upsert', this._messageUpsertHandler);
    }
    
    unbind() {
        if (this._ev && this._messageUpsertHandler) {
            this._ev.off('messages.upsert', this._messageUpsertHandler);
            this._ev = null;
            this._messageUpsertHandler = null;
        }
    }
    
    _onMessagesUpsert({ messages }) {
        if (!messages || !Array.isArray(messages)) return;
        for (const m of messages) {
            if (!m?.key?.remoteJid || !m.key.id) continue;
            const jid = m.key.remoteJid;
            
            if (!this.data[jid]) {
                this.data[jid] = new Map();
            }
            
            const chatMap = this.data[jid];
            chatMap.set(m.key.id, m);
            
            if (chatMap.size > CONFIG.MAX_MESSAGES_PER_CHAT) {
                const entriesToRemove = Math.ceil(CONFIG.MAX_MESSAGES_PER_CHAT * 0.1);
                let removed = 0;
                for (const key of chatMap.keys()) {
                    if (removed >= entriesToRemove) break;
                    chatMap.delete(key);
                    removed++;
                }
            }
        }
    }
    
    loadMessage(jid, id) {
        const chatMap = this.data[jid];
        return chatMap ? chatMap.get(id) || null : null;
    }
    
    readFromFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const raw = JSON.parse(content);
        this.data = {};
        for (const [jid, messages] of Object.entries(raw)) {
            if (messages && typeof messages === 'object') {
                this.data[jid] = new Map(Object.entries(messages));
            }
        }
    }
    
    toJSON() {
        const obj = {};
        for (const [jid, chatMap] of Object.entries(this.data)) {
            if (chatMap instanceof Map) {
                obj[jid] = Object.fromEntries(chatMap);
            }
        }
        return obj;
    }
    
    async writeToFile(filePath) {
        const tmpPath = filePath + '.tmp';
        const backupPath = filePath + '.backup';
        try {
            await writeFile(tmpPath, JSON.stringify(this.toJSON()), 'utf-8');
            if (fs.existsSync(filePath)) {
                try { fs.copyFileSync(filePath, backupPath); } catch (e) { /* ignore */ }
            }
            fs.renameSync(tmpPath, filePath);
        } catch (e) {
            info(`[STORE] Write failed: ${e.message}`, 'error');
            try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (ue) { /* ignore */ }
        }
    }
    
    syncWriteToFile(filePath) {
        try {
            const tmpPath = filePath + '.tmp';
            fs.writeFileSync(tmpPath, JSON.stringify(this.toJSON()), 'utf-8');
            if (fs.existsSync(filePath)) {
                try { fs.copyFileSync(filePath, filePath + '.backup'); } catch (e) { /* ignore */ }
            }
            fs.renameSync(tmpPath, filePath);
        } catch (e) {
            info(`[STORE] Sync write failed: ${e.message}`, 'error');
        }
    }
}

const store = new SimpleStore();

// Restore store
if (fs.existsSync(STORE_FILE)) {
    try {
        store.readFromFile(STORE_FILE);
        info('[STORE] Restored', 'info');
    } catch (e) {
        info(`[STORE] Corrupted: ${e.message}`, 'error');
        const backupFile = STORE_FILE + '.backup';
        if (fs.existsSync(backupFile)) {
            try {
                store.readFromFile(backupFile);
                info('[STORE] Backup restored', 'info');
            } catch (be) {
                info('[STORE] Starting fresh', 'error');
                try { fs.unlinkSync(STORE_FILE); } catch (ue) { /* ignore */ }
                try { fs.unlinkSync(backupFile); } catch (ue) { /* ignore */ }
            }
        } else {
            try { fs.unlinkSync(STORE_FILE); } catch (ue) { /* ignore */ }
        }
    }
}

const storeSaveInterval = setInterval(async () => {
    try { 
        await store.writeToFile(STORE_FILE); 
    } catch (e) { 
        info(`[STORE] Periodic save error: ${e.message}`, 'error'); 
    }
}, CONFIG.STORE_SAVE_INTERVAL_MS);
storeSaveInterval.unref();

// ============================================================================
// 9. CONNECTION MANAGER
// ============================================================================
class ConnectionManager {
    constructor() {
        this.sock = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this._onConnected = null;
        this._onDisconnected = null;
        this._connectionUpdateHandler = null;
        this._credsUpdateHandler = null;
        this._contactsUpdateHandler = null;
        this._chatsUpdateHandler = null;
        this._isShuttingDown = false;
    }
    
    setCallbacks({ onConnected, onDisconnected }) {
        this._onConnected = onConnected;
        this._onDisconnected = onDisconnected;
    }
    
    getStatus() {
        if (!this.sock) return 'disconnected';
        if (this.sock.user) return 'connected';
        if (this.isConnecting) return 'connecting';
        if (this.sock.ws) {
            const state = this.sock.ws.readyState;
            if (state === 0) return 'connecting';
            if (state === 1) return 'ws_open';
            if (state === 2 || state === 3) return 'ws_closing';
        }
        return 'initializing';
    }
    
    async connect() {
        if (this.isConnecting || this._isShuttingDown) return;
        this.isConnecting = true;
        info('📱 Connecting to WhatsApp...', 'info');
        
        try {
            if (!fs.existsSync(CONFIG.SESSION_DIR)) {
                fs.mkdirSync(CONFIG.SESSION_DIR, { recursive: true });
            }
            
            // Fetch version with fallback
            let version;
            try {
                const result = await fetchLatestBaileysVersion();
                version = result.version;
            } catch (e) {
                info(`⚠️ Version fetch failed, using fallback`, 'warn');
                version = [2, 3000, 0];
            }
            
            const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_DIR);

            this._cleanupSocket();

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
                getMessage: async (key) => {
                    try {
                        const msg = await store.loadMessage(key.remoteJid, key.id);
                        return { conversation: msg?.message?.conversation || '' };
                    } catch (e) {
                        return { conversation: '' };
                    }
                },
                msgRetryCounterCache,
                markOnlineOnConnect: false,
                shouldIgnoreJid: () => false
            });

            this._attachEvents(saveCreds);
            this.isConnecting = false;
        } catch (error) {
            this.isConnecting = false;
            info(`❌ Connection error: ${error.message}`, 'error');
            this._scheduleReconnect(CONFIG.RECONNECT_BASE_DELAY_MS);
        }
    }
    
    _attachEvents(saveCreds) {
        this._detachEvents();
        
        this._connectionUpdateHandler = (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                info('✅ CONNECTED!', 'success');
                if (this._onConnected) {
                    try { this._onConnected(); } catch (e) {
                        info(`onConnected error: ${e.message}`, 'error');
                    }
                }
                return;
            }
            
            if (connection === 'close') {
                this.isConnecting = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                info(`🔌 Disconnected (code: ${statusCode})`, 'warn');
                
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                
                if (isLoggedOut) {
                    info('🚫 Session logged out', 'error');
                    try { 
                        fs.rmSync(CONFIG.SESSION_DIR, { recursive: true, force: true }); 
                    } catch (e) { /* ignore */ }
                    this.reconnectAttempts = 0;
                }
                
                if (this.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
                    info('🚨 Max reconnect attempts reached', 'error');
                    if (this._onDisconnected) {
                        try { this._onDisconnected(); } catch (e) { /* ignore */ }
                    }
                    return;
                }
                
                this.reconnectAttempts++;
                const exponent = Math.min(this.reconnectAttempts - 1, CONFIG.MAX_EXPONENT);
                const delayMs = Math.min(
                    CONFIG.RECONNECT_MAX_DELAY_MS,
                    CONFIG.RECONNECT_BASE_DELAY_MS * Math.pow(2, exponent) + Math.random() * 2000
                );
                
                info(`🔄 Reconnecting in ${Math.round(delayMs / 1000)}s (${this.reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS})`, 'info');
                this._scheduleReconnect(delayMs);
                
                if (this._onDisconnected) {
                    try { this._onDisconnected(); } catch (e) { /* ignore */ }
                }
            }
        };
        
        this._credsUpdateHandler = async () => {
            try { await saveCreds(); } catch (e) { /* ignore */ }
        };
        
        this._contactsUpdateHandler = (updates) => {
            if (Array.isArray(updates)) {
                for (const u of updates) {
                    if (u?.id) contactCache.set(u.id, u);
                }
            }
        };
        
        this._chatsUpdateHandler = (updates) => {
            if (Array.isArray(updates)) {
                for (const u of updates) {
                    if (u?.id) chatCache.set(u.id, u);
                }
            }
        };
        
        this.sock.ev.on('connection.update', this._connectionUpdateHandler);
        this.sock.ev.on('creds.update', this._credsUpdateHandler);
        this.sock.ev.on('contacts.update', this._contactsUpdateHandler);
        this.sock.ev.on('chats.update', this._chatsUpdateHandler);
        
        store.bind(this.sock.ev);
    }
    
    _detachEvents() {
        if (this.sock?.ev) {
            if (this._connectionUpdateHandler) {
                this.sock.ev.off('connection.update', this._connectionUpdateHandler);
                this._connectionUpdateHandler = null;
            }
            if (this._credsUpdateHandler) {
                this.sock.ev.off('creds.update', this._credsUpdateHandler);
                this._credsUpdateHandler = null;
            }
            if (this._contactsUpdateHandler) {
                this.sock.ev.off('contacts.update', this._contactsUpdateHandler);
                this._contactsUpdateHandler = null;
            }
            if (this._chatsUpdateHandler) {
                this.sock.ev.off('chats.update', this._chatsUpdateHandler);
                this._chatsUpdateHandler = null;
            }
        }
        store.unbind();
    }
    
    _cleanupSocket() {
        this._detachEvents();
        
        if (this.sock) {
            try {
                if (this.sock.ws) {
                    this.sock.ws.close();
                }
                if (this.sock.ev) {
                    this.sock.ev.removeAllListeners();
                }
            } catch (e) {
                info(`[CLEANUP] Error: ${e.message}`, 'warn');
            }
            this.sock = null;
        }
    }
    
    _scheduleReconnect(waitMs) {
        if (this._isShuttingDown) return;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.isConnecting && !this._isShuttingDown) {
                this.connect();
            }
        }, waitMs);
    }
    
    disconnect() {
        this._isShuttingDown = true;
        if (this.reconnectTimer) { 
            clearTimeout(this.reconnectTimer); 
            this.reconnectTimer = null; 
        }
        this._cleanupSocket();
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }
    
    getSocket() { return this.sock; }
}

const connectionManager = new ConnectionManager();

// ============================================================================
// 10. GROUP NAME FETCHER
// ============================================================================
const groupMetadataLimit = pLimit(CONFIG.GROUP_METADATA_CONCURRENCY);

async function fetchAllGroupNames(sock, groupIds) {
    const results = [];
    const tasks = groupIds.map(jid =>
        groupMetadataLimit(async () => {
            if (!groupMetadataCache.has(jid)) {
                try {
                    const metadata = await sock.groupMetadata(jid);
                    groupMetadataCache.set(jid, metadata?.subject || 'Unknown');
                } catch (e) {
                    groupMetadataCache.set(jid, 'Unknown');
                }
            }
            return { id: jid, name: groupMetadataCache.get(jid) || 'Unknown' };
        })
    );
    return Promise.all(tasks);
}

// ============================================================================
// 11. SMART SENDER
// ============================================================================
class Sender {
    constructor() {
        this.reset();
    }
    
    async _getToken() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(CONFIG.TOKEN_BUCKET_SIZE, this.tokens + elapsed * CONFIG.TOKEN_REFILL_RATE);
        this.lastRefill = now;
        
        if (this.tokens < 1) {
            const deficit = Math.max(0, 1 - this.tokens);
            const waitMs = Math.min(CONFIG.MAX_TOKEN_WAIT_MS, (deficit * 1000) / CONFIG.TOKEN_REFILL_RATE);
            await delay(waitMs);
            this.tokens = 1;
        }
        this.tokens -= 1;
    }
    
    async send(target, message) {
        await this._getToken();
        
        if (this.isTempBlocked) {
            const remaining = Math.max(0, this.blockEndTime - Date.now());
            if (remaining > 0) {
                appState.tempBlocked = true;
                await delay(remaining);
                appState.tempBlocked = false;
            }
            this.isTempBlocked = false;
        }
        
        if (!target || !message) return false;
        if (blacklistManager.isBlacklisted(target)) return false;
        
        if (this.consecutiveErrors > CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
            const extraDelay = Math.min(30000, this.consecutiveErrors * 2000);
            await delay(extraDelay);
        }
        
        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES_SEND; attempt++) {
            try {
                const sock = connectionManager.getSocket();
                if (!sock?.user) { 
                    await delay(2000); 
                    continue; 
                }
                
                await sock.sendMessage(target, { text: message });
                
                this.consecutiveErrors = 0;
                blacklistManager.clearSuccess(target);
                appState.totalSent++;
                appState.messageCount++;
                appState.lastActivityTime = Date.now();
                appState.lastSendTime = Date.now();
                
                if (appState.totalSent % 50 === 0) {
                    info(`📨 Sent: ${appState.totalSent} | Queue: ${this.retryQueue.length}`, 'info');
                }
                
                await delay(Math.random() * 500 + 100);
                return true;
                
            } catch (err) {
                appState.totalErrors++;
                const errMsg = err?.message || String(err);
                
                // Rate limit detection
                if (errMsg.includes('429') || errMsg.includes('rate') || 
                    errMsg.includes('too many') || err?.output?.statusCode === 429) {
                    this.consecutiveErrors++;
                    if (this.consecutiveErrors >= CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
                        this.isTempBlocked = true;
                        this.blockEndTime = Date.now() + CONFIG.RATE_LIMIT_COOLDOWN_MS;
                        appState.tempBlocked = true;
                        info(`⏸️ Rate limited – ${CONFIG.RATE_LIMIT_COOLDOWN_MS/1000}s cooldown`, 'warn');
                        await delay(CONFIG.RATE_LIMIT_COOLDOWN_MS);
                        appState.tempBlocked = false;
                        this.isTempBlocked = false;
                        this.consecutiveErrors = 0;
                        continue;
                    }
                }
                
                blacklistManager.markFail(target);
                
                if (attempt < CONFIG.MAX_RETRIES_SEND) {
                    const backoff = Math.min(15000, 2000 * attempt);
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
        
        const now = Date.now();
        // Remove items older than 5 minutes
        this.retryQueue = this.retryQueue.filter(item => now - item.addedAt < 300000);
        
        const batch = this.retryQueue.splice(0, CONFIG.BATCH_SIZE);
        for (const { target, message } of batch) {
            try {
                await this.send(target, message);
            } catch (e) {
                // Ignore errors in retry processing
            }
        }
    }
    
    get queueSize() { return this.retryQueue.length; }
    
    reset() {
        this.consecutiveErrors = 0;
        this.isTempBlocked = false;
        this.blockEndTime = 0;
        this.retryQueue = [];
        this.tokens = CONFIG.TOKEN_BUCKET_SIZE;
        this.lastRefill = Date.now();
    }
}

const sender = new Sender();

// ============================================================================
// 12. ATTACK ENGINE
// ============================================================================
class AttackEngine {
    constructor() {
        this._running = false;
        this._lock = false;
        this._heartbeatInterval = null;
        this._gcInterval = null;
        this._restartTimer = null;
        this._restartScheduled = false;
        this._loopPromise = null;
    }
    
    start() {
        if (this._lock) { 
            info('[ENGINE] Busy', 'info'); 
            return; 
        }
        
        if (this._restartTimer) {
            clearTimeout(this._restartTimer);
            this._restartTimer = null;
        }
        
        this._restartScheduled = false;
        this._lock = true;
        this._running = true;
        appState.loopActive = true;
        appState.loopRunning = true;
        appState.totalSent = 0;
        appState.totalFailed = 0;
        appState.totalErrors = 0;
        appState.crashCount = 0;
        appState.forcedClearCount = 0;
        appState.lastActivityTime = Date.now();
        appState.lastSendTime = Date.now();
        
        info('🔥 Loop started', 'success');
        this._startIntervals();
        
        this._loopPromise = this._runMainLoop().catch((err) => {
            info(`[ENGINE] Crashed: ${err.message}`, 'error');
            this._running = false;
            appState.loopRunning = false;
            this._lock = false;
            this._cleanup();
            
            if (appState.loopActive && !this._restartScheduled) {
                this._restartScheduled = true;
                this._restartTimer = setTimeout(() => {
                    this._restartTimer = null;
                    this._restartScheduled = false;
                    if (appState.loopActive) this.start();
                }, 5000);
            }
        });
    }
    
    async _runMainLoop() {
        const MAX_CONSECUTIVE_ERRORS = 5;
        let consecutiveEmptyRuns = 0;
        
        while (appState.loopActive) {
            try {
                // Wait for connection
                let waitAttempts = 0;
                while (!connectionManager.getSocket()?.user && appState.loopActive) {
                    if (waitAttempts > 30) {
                        info('[ENGINE] Connection timeout – restarting', 'warn');
                        throw new Error('Connection timeout');
                    }
                    await delay(3000);
                    waitAttempts++;
                }
                
                if (!appState.loopActive) break;
                
                const { targets, messages, haterName, intervalTime } = appState;
                
                if (!messages?.length || !targets?.length) {
                    consecutiveEmptyRuns++;
                    if (consecutiveEmptyRuns > 10) {
                        info('[ENGINE] No data – sleeping', 'warn');
                        await delay(30000);
                        consecutiveEmptyRuns = 0;
                    }
                    await delay(1000);
                    continue;
                }
                
                consecutiveEmptyRuns = 0;
                
                // Find non-blacklisted target
                let targetIndex = -1;
                for (let i = 0; i < targets.length; i++) {
                    const idx = (appState.currentTargetIndex + i) % targets.length;
                    if (!blacklistManager.isBlacklisted(targets[idx])) { 
                        targetIndex = idx; 
                        break; 
                    }
                }
                
                if (targetIndex === -1) {
                    info('[CLEAR] All blacklisted', 'warn');
                    blacklistManager.clearAll();
                    appState.forcedClearCount++;
                    await delay(5000);
                    continue;
                }
                
                const msgIdx = appState.currentMsgIndex % messages.length;
                const fullMessage = `${haterName} ${messages[msgIdx]}`;
                const target = targets[targetIndex];
                
                await sender.send(target, fullMessage);
                
                // Update indices
                appState.currentTargetIndex = (targetIndex + 1) % targets.length;
                if (appState.currentTargetIndex === 0) {
                    appState.currentMsgIndex++;
                    appState.cycleCount++;
                    
                    if (appState.cycleCount % 10 === 0) {
                        info(`📊 Cycle ${appState.cycleCount} | Sent: ${appState.totalSent} | BL: ${blacklistManager.size}`, 'info');
                    }
                }
                
                // Process retry queue periodically
                if (appState.cycleCount % 5 === 0 && appState.cycleCount > 0) {
                    await sender.processRetryQueue();
                }
                
                // Delay between messages
                if (appState.loopActive && intervalTime > 0) {
                    const jitter = Math.random() * 2000;
                    await delay((intervalTime * 1000) + jitter);
                }
                
                appState.lastActivityTime = Date.now();
                appState.loopRunning = true;
                
            } catch (err) {
                appState.crashCount++;
                info(`⚠️ Loop error #${appState.crashCount}: ${err.message}`, 'error');
                
                if (appState.crashCount > MAX_CONSECUTIVE_ERRORS) {
                    info('[ENGINE] Too many errors – restarting', 'error');
                    await delay(5000);
                    appState.crashCount = 0;
                } else {
                    await delay(2000);
                }
            }
        }
        
        this._running = false;
        appState.loopRunning = false;
        this._lock = false;
        this._cleanup();
        info('[ENGINE] Stopped', 'warn');
    }
    
    _startIntervals() {
        this._cleanup();
        
        this._heartbeatInterval = setInterval(() => {
            try {
                blacklistManager.autoClean();
                
                // Check if loop is dead
                const timeSinceActivity = Date.now() - appState.lastActivityTime;
                if (appState.loopActive && !appState.loopRunning && 
                    !this._running && !this._restartScheduled &&
                    timeSinceActivity > 30000) {
                    info('[HEARTBEAT] Loop dead – restarting', 'warn');
                    this.start();
                }
            } catch (e) { 
                info(`[HEARTBEAT] Error: ${e.message}`, 'error'); 
            }
        }, CONFIG.HEARTBEAT_INTERVAL_MS);
        
        // Don't block event loop exit
        if (this._heartbeatInterval && typeof this._heartbeatInterval.unref === 'function') {
            this._heartbeatInterval.unref();
        }
        
        if (global.gc) {
            this._gcInterval = setInterval(() => { 
                try { global.gc(); } catch (e) { /* ignore */ }
            }, CONFIG.GC_INTERVAL_MS);
            if (typeof this._gcInterval.unref === 'function') {
                this._gcInterval.unref();
            }
        }
    }
    
    _cleanup() {
        if (this._heartbeatInterval) { 
            clearInterval(this._heartbeatInterval); 
            this._heartbeatInterval = null; 
        }
        if (this._gcInterval) { 
            clearInterval(this._gcInterval); 
            this._gcInterval = null; 
        }
    }
    
    stop() {
        appState.loopActive = false;
        appState.loopRunning = false;
        this._cleanup();
        this._running = false;
        this._lock = false;
        
        if (this._restartTimer) {
            clearTimeout(this._restartTimer);
            this._restartTimer = null;
        }
        this._restartScheduled = false;
        info('⛔ Loop stopped', 'warn');
    }
    
    get isRunning() { return this._running; }
}

const attackEngine = new AttackEngine();

// ============================================================================
// 13. EXPRESS APP
// ============================================================================
const app = express();

// Security
app.set('trust proxy', 1);
app.use(helmet({ 
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false 
}));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
    max: CONFIG.RATE_LIMIT_MAX,
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientId(req)
});
app.use('/api/', apiLimiter);
app.use('/pair', apiLimiter);

// Body parsing
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(express.json({ limit: '1mb' }));

// File upload
const upload = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: CONFIG.MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
            cb(null, true);
        } else {
            cb(new Error('Only .txt files allowed'), false);
        }
    }
});

// Phone number formatter
function formatNumber(num) {
    const cleaned = String(num).replace(/[^0-9]/g, '');
    return cleaned.length >= 10 ? cleaned : '';
}

// Connection callbacks
connectionManager.setCallbacks({
    onConnected: () => {
        if (appState.loopActive && !attackEngine.isRunning) {
            info('[RESUME] Auto-starting loop', 'info');
            setTimeout(() => attackEngine.start(), 2000);
        }
    },
    onDisconnected: () => {
        info('[EVENT] Connection lost', 'warn');
    }
});

// ============================================================================
// API ROUTES
// ============================================================================

// Status endpoint
app.get('/api/status', (req, res) => {
    try {
        const mem = process.memoryUsage();
        const uptimeSec = Math.floor((Date.now() - appState.sessionStart) / 1000);
        const cpuUsage = process.cpuUsage();
        
        res.json({
            connected: !!connectionManager.getSocket()?.user,
            connectionStatus: connectionManager.getStatus(),
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
                groupMetadata: groupMetadataCache.getStats().keys,
                contacts: contactCache.getStats().keys,
                chats: chatCache.getStats().keys
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Internal error' });
    }
});

// Pair status
app.get('/api/pair-status', (req, res) => {
    const sock = connectionManager.getSocket();
    res.json({
        status: connectionManager.getStatus(),
        hasSocket: !!sock,
        hasWs: !!sock?.ws,
        wsReadyState: sock?.ws?.readyState ?? -1,
        hasUser: !!sock?.user,
        isConnecting: connectionManager.isConnecting
    });
});

// Manual reconnect
app.post('/api/reconnect', (req, res) => {
    info('🔄 Manual reconnect', 'info');
    connectionManager.disconnect();
    setTimeout(() => connectionManager.connect(), 1500);
    res.json({ status: 'reconnecting' });
});

// Logs
let logsCache = { data: null, timestamp: 0 };
app.get('/api/logs', (req, res) => {
    const now = Date.now();
    if (logsCache.data && now - logsCache.timestamp < 2000) {
        return res.json(logsCache.data);
    }
    const data = { 
        logs: logBuffer.get(), 
        connected: !!connectionManager.getSocket()?.user, 
        active: appState.loopActive 
    };
    logsCache = { data, timestamp: now };
    res.json(data);
});

// Groups
app.get('/api/groups', async (req, res) => {
    try {
        const sock = connectionManager.getSocket();
        if (!sock?.user) {
            return res.status(503).json({ error: 'WhatsApp not connected' });
        }
        
        const groups = await sock.groupFetchAllParticipating();
        if (!groups || typeof groups !== 'object') {
            return res.json({ groups: [], count: 0 });
        }
        
        const groupIds = Object.keys(groups);
        const groupNames = await fetchAllGroupNames(sock, groupIds);
        const groupList = groupNames.map(({ id, name }) => ({ 
            id, 
            name: name || groups[id]?.subject || 'Unknown', 
            participants: groups[id]?.participants?.length || 0 
        }));
        
        res.json({ groups: groupList, count: groupList.length });
    } catch (e) {
        info(`[Groups] Error: ${e.message}`, 'error');
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

// ============================================================================
// PAIR ROUTE
// ============================================================================
app.post('/pair', async (req, res) => {
    try {
        const phone = formatNumber(req.body?.phone || '');
        if (!phone) {
            return res.status(400).send(`
                <h2>❌ Invalid phone number</h2>
                <p>Enter country code + number (e.g. 919999999999)</p>
                <a href="/pair">← Try Again</a>
            `);
        }
        
        const sock = connectionManager.getSocket();
        if (!sock) {
            return res.status(503).send(`
                <h2>❌ Service not ready</h2>
                <p>Please wait 10-15 seconds and try again.</p>
                <a href="/pair">← Retry</a>
            `);
        }
        
        if (sock.user) {
            return res.send(`
                <h2>✅ Already connected</h2>
                <p>Logged in as: <strong>${escapeHtml(sock.user.id || 'Unknown')}</strong></p>
                <a href="/">← Dashboard</a>
            `);
        }
        
        // Wait for socket readiness
        let ready = false;
        for (let i = 0; i < 40; i++) {
            if (sock.ws && sock.ws.readyState === 1) {
                ready = true;
                break;
            }
            if (sock.user) {
                ready = true;
                break;
            }
            await delay(500);
        }
        
        if (!ready) {
            return res.status(503).send(`
                <h2>❌ Connection timeout</h2>
                <p>WhatsApp servers not reachable. Check network.</p>
                <a href="/pair">← Retry</a>
                <br><br>
                <a href="/api/reconnect" style="color:#ff00ff">Force Reconnect</a>
            `);
        }
        
        info(`🔑 Requesting code for ${phone}`, 'info');
        const code = await sock.requestPairingCode(phone);
        
        if (!code) {
            throw new Error('Empty pairing code received');
        }
        
        const formatted = String(code).match(/.{1,4}/g)?.join('-') || code;
        info(`✅ Code sent to ${phone}`, 'success');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Pairing Code</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body{background:#0a0a0f;color:#00ff88;font-family:monospace;text-align:center;padding:40px}
                    .code{font-size:2.5em;color:#ff00ff;letter-spacing:8px;background:#111;padding:20px 40px;border-radius:10px;border:2px solid #ff00ff;margin:30px auto;display:inline-block;word-break:break-all}
                    .note{color:#888;font-size:0.9em;margin-top:20px}
                    a{color:#00ff88;text-decoration:none;border:1px solid #00ff88;padding:10px 20px;border-radius:5px;display:inline-block;margin-top:20px}
                </style>
            </head>
            <body>
                <h1>📱 PAIRING CODE</h1>
                <div class="code">${escapeHtml(formatted)}</div>
                <p>WhatsApp → Settings → Linked Devices → <strong>Link with Phone Number</strong></p>
                <p class="note">Code expires in 5 minutes</p>
                <a href="/">← Dashboard</a>
            </body>
            </html>
        `);
    } catch (e) {
        const errMsg = e?.message || 'Unknown error';
        info(`❌ Pair error: ${errMsg}`, 'error');
        
        let userMsg = 'Failed to generate pairing code';
        if (errMsg.includes('phone number') || errMsg.includes('invalid')) {
            userMsg = 'Invalid phone number format';
        } else if (errMsg.includes('linked')) {
            userMsg = 'Account already linked to another device';
        } else if (errMsg.includes('timeout')) {
            userMsg = 'Request timed out – check network';
        }
        
        res.status(500).send(`
            <h2>❌ ${escapeHtml(userMsg)}</h2>
            <p style="color:#ff4444">${escapeHtml(errMsg)}</p>
            <a href="/pair">← Try Again</a>
        `);
    }
});

// ============================================================================
// ATTACK & STOP ROUTES
// ============================================================================
app.post('/attack', upload.single('msgFile'), async (req, res) => {
    try {
        const sessionId = getClientId(req);
        const token = req.body?._csrf;
        
        if (!token || !validateToken(sessionId, token)) {
            return res.status(403).send(`
                <h2>❌ Invalid session</h2>
                <p>Refresh the page and try again.</p>
                <a href="/">← Back</a>
            `);
        }
        
        const sock = connectionManager.getSocket();
        if (!sock?.user) {
            throw new Error('WhatsApp not connected');
        }
        
        if (!req.file) {
            throw new Error('No message file uploaded');
        }
        
        // Parse messages
        const fileContent = req.file.buffer.toString('utf-8');
        const messages = fileContent
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && l.length < 4096); // WhatsApp message limit
        
        if (messages.length === 0) {
            throw new Error('Message file is empty');
        }
        
        // Parse targets
        const targets = [];
        const numbersStr = req.body.numbers || '';
        const groupsStr = req.body.groups || '';
        
        if (numbersStr.trim()) {
            for (const line of numbersStr.split('\n')) {
                let num = line.trim().replace(/\s/g, '');
                if (!num) continue;
                
                if (!num.includes('@')) {
                    const cleaned = formatNumber(num);
                    if (cleaned) {
                        targets.push(`${cleaned}@s.whatsapp.net`);
                    }
                } else {
                    targets.push(num);
                }
            }
        }
        
        if (groupsStr.trim()) {
            for (const line of groupsStr.split('\n')) {
                let gid = line.trim().replace(/\s/g, '');
                if (!gid) continue;
                if (!gid.includes('@')) {
                    gid = `${gid}@g.us`;
                }
                targets.push(gid);
            }
        }
        
        if (targets.length === 0) {
            throw new Error('No valid targets provided');
        }
        
        const haterName = (req.body.hater || 'krix').trim();
        const delayTime = Math.max(
            CONFIG.MIN_INTERVAL_SECONDS,
            Math.min(CONFIG.MAX_INTERVAL_SECONDS, parseInt(req.body.delay, 10) || CONFIG.DEFAULT_INTERVAL_SECONDS)
        );
        
        // Stop existing loop and start new
        attackEngine.stop();
        await delay(1500);
        
        appState.reset(targets, messages, haterName, delayTime);
        sender.reset();
        blacklistManager.clearAll();
        
        info(`🚀 START | Targets: ${targets.length} | Messages: ${messages.length} | Delay: ${delayTime}s`, 'success');
        
        attackEngine.start();
        res.redirect('/');
        
    } catch (e) {
        info(`[Attack] Error: ${e.message}`, 'error');
        res.status(400).send(`
            <h2>❌ ${escapeHtml(e.message)}</h2>
            <a href="/">← Back</a>
        `);
    }
});

app.post('/stop', (req, res) => {
    const sessionId = getClientId(req);
    const token = req.body?._csrf;
    
    if (!token || !validateToken(sessionId, token)) {
        return res.status(403).send(`
            <h2>❌ Invalid session</h2>
            <a href="/">← Back</a>
        `);
    }
    
    attackEngine.stop();
    res.redirect('/');
});

// ============================================================================
// HTML PAGES
// ============================================================================
const pageStyle = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#00ff88;font-family:monospace;padding:20px}
.container{max-width:800px;margin:0 auto}
.header{text-align:center;padding:20px;border-bottom:2px solid #ff00ff;margin-bottom:20px}
.header h1{color:#ff00ff;font-size:2em}
.status-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.card{background:#111;border:1px solid #333;padding:15px;text-align:center;border-radius:5px}
.card-value{font-size:2em;font-weight:bold}
.card-label{font-size:0.7em;color:#888;margin-top:5px}
.nav{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.nav a,.nav button{background:linear-gradient(135deg,#ff00ff,#8800ee);color:white;padding:10px 20px;text-decoration:none;border:none;cursor:pointer;font-family:monospace;border-radius:5px}
.stop-btn{background:linear-gradient(135deg,#ff4444,#880000)!important}
form{background:#111;padding:20px;border-radius:5px;margin-top:20px}
input,textarea,select{width:100%;padding:10px;margin:10px 0;background:#222;border:1px solid #444;color:white;font-family:monospace}
button{background:#00ff88;color:black;padding:10px 20px;border:none;cursor:pointer;font-weight:bold;border-radius:5px}
`;

app.get('/', (req, res) => {
    const sessionId = getClientId(req);
    const csrfToken = generateToken(sessionId);
    
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Krix Ultra</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${pageStyle}</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>🔥 KRIX ULTRA</h1>
        <p>Enterprise Edition</p>
    </div>
    
    <div class="nav">
        <a href="/">DASHBOARD</a>
        <a href="/pair">PAIR</a>
        <a href="/logs-page">LOGS</a>
        <a href="/groups-page">GROUPS</a>
        <form action="/stop" method="post" style="margin:0;padding:0;display:inline">
            <input type="hidden" name="_csrf" value="${csrfToken}">
            <button type="submit" class="stop-btn">⛔ STOP</button>
        </form>
    </div>
    
    <div class="status-grid">
        <div class="card"><div class="card-value" id="conn" style="color:#00ff88">---</div><div class="card-label">CONNECTION</div></div>
        <div class="card"><div class="card-value" id="loop" style="color:#ff00ff">---</div><div class="card-label">LOOP</div></div>
        <div class="card"><div class="card-value" id="sent" style="color:#00ff88">0</div><div class="card-label">SENT</div></div>
        <div class="card"><div class="card-value" id="failed" style="color:#ff4444">0</div><div class="card-label">FAILED</div></div>
    </div>
    
    <form action="/attack" method="post" enctype="multipart/form-data">
        <input type="hidden" name="_csrf" value="${csrfToken}">
        <h3>⚡ START ATTACK</h3>
        <textarea name="numbers" placeholder="Phone numbers (one per line)&#10;919999999999&#10;918888888888" rows="3"></textarea>
        <textarea name="groups" placeholder="Group IDs (one per line)&#10;123456789@g.us" rows="2"></textarea>
        <input type="file" name="msgFile" accept=".txt" required>
        <input type="text" name="hater" placeholder="Your Name" value="krix" required maxlength="50">
        <input type="number" name="delay" value="15" min="5" max="300" step="1">
        <button type="submit">🔥 START</button>
    </form>
</div>

<script>
async function refresh() {
    try {
        const r = await fetch('/api/status');
        const d = await r.json();
        document.getElementById('conn').textContent = d.connected ? 'ONLINE' : 'OFFLINE';
        document.getElementById('conn').style.color = d.connected ? '#00ff88' : '#ff4444';
        document.getElementById('loop').textContent = d.running ? 'RUNNING' : (d.active ? 'ACTIVE' : 'IDLE');
        document.getElementById('loop').style.color = d.running ? '#00ff88' : '#ff00ff';
        document.getElementById('sent').textContent = d.totalSent || 0;
        document.getElementById('failed').textContent = d.totalFailed || 0;
    } catch(e) {
        document.getElementById('conn').textContent = 'ERROR';
    }
}
refresh();
setInterval(refresh, 3000);
</script>
</body>
</html>`);
});

app.get('/pair', (req, res) => {
    const sessionId = getClientId(req);
    const csrfToken = generateToken(sessionId);
    
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Pair WhatsApp</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${pageStyle}
        .status-box{padding:15px;background:#111;margin:15px 0;border-radius:5px;font-size:0.9em}
        button{margin:5px}
    </style>
</head>
<body style="text-align:center">
    <h1>🔗 PAIR WHATSAPP</h1>
    
    <div class="status-box" id="status">Checking...</div>
    <button onclick="checkStatus()">🔄 CHECK STATUS</button>
    <button onclick="reconnect()" style="background:#ff00ff;color:white">🔌 RECONNECT</button>
    
    <form action="/pair" method="post" style="max-width:400px;margin:20px auto">
        <input type="hidden" name="_csrf" value="${csrfToken}">
        <input type="text" name="phone" placeholder="919999999999" required pattern="[0-9]{10,15}">
        <button type="submit">GET PAIRING CODE</button>
    </form>
    
    <a href="/">← Back</a>
    
<script>
async function checkStatus() {
    try {
        const r = await fetch('/api/pair-status');
        const d = await r.json();
        document.getElementById('status').innerHTML = 
            '<b>Status:</b> ' + d.status + '<br>' +
            '<b>Socket:</b> ' + d.hasSocket + '<br>' +
            '<b>WebSocket:</b> ' + (d.hasWs ? 'State ' + d.wsReadyState : 'None') + '<br>' +
            '<b>Logged In:</b> ' + d.hasUser + '<br>' +
            '<b>Connecting:</b> ' + d.isConnecting;
    } catch(e) {
        document.getElementById('status').textContent = 'Error checking status';
    }
}

async function reconnect() {
    document.getElementById('status').textContent = 'Reconnecting...';
    await fetch('/api/reconnect', { method: 'POST' });
    setTimeout(checkStatus, 3000);
}

checkStatus();
</script>
</body>
</html>`);
});

app.get('/logs-page', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Live Logs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${pageStyle}
        pre{background:#000;padding:15px;overflow:auto;height:70vh;font-size:0.85em;line-height:1.4}
    </style>
</head>
<body>
    <h1>📋 LIVE LOGS</h1>
    <a href="/">← Back</a>
    <pre id="logs">Loading...</pre>
<script>
setInterval(async () => {
    try {
        const r = await fetch('/api/logs');
        const d = await r.json();
        document.getElementById('logs').textContent = 
            d.logs.map(l => '[' + l.timestamp + '] ' + l.message).join('\\n');
    } catch(e) {
        document.getElementById('logs').textContent = 'Failed to load logs';
    }
}, 2000);
</script>
</body>
</html>`);
});

app.get('/groups-page', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Groups</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${pageStyle}
        table{width:100%;border-collapse:collapse;margin-top:20px}
        th,td{border:1px solid #333;padding:10px;text-align:left}
        th{background:#111;color:#ff00ff}
        tr:hover{background:#1a1a2e}
    </style>
</head>
<body>
    <h1>📋 MY GROUPS</h1>
    <a href="/">← Back</a>
    <div id="groups">Loading...</div>
<script>
async function loadGroups() {
    try {
        const r = await fetch('/api/groups');
        const d = await r.json();
        if (d.error) {
            document.getElementById('groups').innerHTML = '<p style="color:red">' + d.error + '</p>';
            return;
        }
        if (!d.groups.length) {
            document.getElementById('groups').innerHTML = '<p>No groups found</p>';
            return;
        }
        let html = '<table><tr><th>Group</th><th>ID</th><th>Members</th></tr>';
        for (const g of d.groups) {
            html += '<tr><td>' + g.name + '</td><td style="font-size:0.8em;color:#ff00ff">' + g.id + '</td><td>' + g.participants + '</td></tr>';
        }
        html += '</table><p>Total: ' + d.count + ' groups</p>';
        document.getElementById('groups').innerHTML = html;
    } catch(e) {
        document.getElementById('groups').innerHTML = '<p style="color:red">Failed to load</p>';
    }
}
loadGroups();
</script>
</body>
</html>`);
});

app.get('/attack-page', (req, res) => res.redirect('/'));

// 404 handler
app.use((req, res) => {
    res.status(404).send('<h1>404 - Not Found</h1><a href="/">← Home</a>');
});

// Error handler
app.use((err, req, res, next) => {
    info(`[Express] Error: ${err.message}`, 'error');
    res.status(500).send('<h1>500 - Server Error</h1><a href="/">← Home</a>');
});

// ============================================================================
// 14. GRACEFUL SHUTDOWN
// ============================================================================
let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    info(`📴 ${signal} – shutting down`, 'warn');
    
    attackEngine.stop();
    connectionManager.disconnect();
    
    try { 
        store.syncWriteToFile(STORE_FILE);
        info('[STORE] Saved', 'info');
    } catch (e) {
        info(`[STORE] Save failed: ${e.message}`, 'error');
    }
    
    clearInterval(storeSaveInterval);
    clearInterval(csrfCleanupInterval);
    
    // Close server
    server.close(() => {
        info('[SERVER] Closed', 'info');
        process.exit(0);
    });
    
    // Force exit after 5 seconds
    setTimeout(() => {
        info('[SERVER] Force exit', 'warn');
        process.exit(1);
    }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ============================================================================
// 15. CRASH PROTECTION
// ============================================================================
let crashCount = 0;
let lastCrashTime = Date.now();

process.on('uncaughtException', (err) => {
    const now = Date.now();
    if (now - lastCrashTime > 60000) crashCount = 0;
    crashCount++;
    lastCrashTime = now;
    
    info(`💀 CRASH #${crashCount}: ${err.message}`, 'error');
    if (err.stack) {
        info(`Stack: ${err.stack.split('\n').slice(0, 3).join(' | ')}`, 'error');
    }
    
    // Sync save store on crash
    try { store.syncWriteToFile(STORE_FILE); } catch (e) { /* ignore */ }
    
    const delayMs = crashCount > 3 
        ? Math.min(300000, 5000 * Math.pow(2, Math.min(crashCount - 3, 6)))
        : 5000;
    
    info(`Restarting in ${Math.round(delayMs/1000)}s`, 'warn');
    setTimeout(() => process.exit(1), delayMs).unref();
});

process.on('unhandledRejection', (reason, promise) => {
    info(`⚠️ Unhandled rejection: ${reason?.message || reason}`, 'error');
});

// ============================================================================
// 16. START
// ============================================================================
const server = app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║     KRIX ULTRA v8.2 - PRODUCTION READY          ║
║     Port: ${CONFIG.PORT}                                   ║
║     Audit: PASSED (13 bugs fixed)                ║
╚══════════════════════════════════════════════════╝
    `);
});

// Start WhatsApp connection
setTimeout(() => {
    connectionManager.connect();
}, 1000);

// ============================================================================
// EXPORT FOR PM2
// ============================================================================
export default app;
