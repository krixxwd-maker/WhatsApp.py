(async () => {
  try {
    const {
      makeWASocket,
      useMultiFileAuthState,
      delay,
      DisconnectReason,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore
    } = await import("@whiskeysockets/baileys");
    
    const fs = await import('fs');
    const pino = (await import("pino")).default;
    const readline = (await import("readline")).createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const axios = await import("axios");
    const os = await import('os');
    const crypto = await import("crypto");
    const { exec } = await import("child_process");
    const path = await import('path');
    const NodeCache = (await import('node-cache')).default;

    // Enhanced question function with timeout
    const question = (query, timeout = 30000) => new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve('');
      }, timeout);
      readline.question(query, (answer) => {
        clearTimeout(timer);
        resolve(answer);
      });
    });

    // Enhanced color function
    const color = (text, colorCode) => `\x1b[${colorCode}m${text}\x1b[0m`;

    // Banner display
    const showBanner = () => {
      console.clear();
      console.log(color("██╗    ██╗██╗  ██╗ █████╗ ████████╗███████╗ █████╗ ██████╗", "32"));
      console.log(color("██║    ██║██║  ██║██╔══██╗╚══██╔══╝██╔════╝██╔══██╗██╔══██╗", "35"));
      console.log(color("██║ █╗ ██║███████║███████║   ██║   ███████╗███████║██████╔╝", "34"));
      console.log(color("██║███╗██║██╔══██║██╔══██║   ██║   ╚════██║██╔══██║██╔═══╝", "33"));
      console.log(color("╚███╔███╔╝██║  ██║██║  ██║   ██║   ███████║██║  ██║██║     ", "36"));
      console.log(color(" ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝", "37"));
      console.log(color("╔═════════════════════════════════════════════════════════════╗", "32"));
      console.log(color("║  TOOLS       : WHATSAPP🔥 LOD3R                  ", "33"));
      console.log(color("║  RULL3X     : T3RG3T WHATSSP NUMB3R", "31"));
      console.log(color("║  V3RSO1N  : WHATSSP 2.376", "34"));
      console.log(color("║  ONW3R      : KRIX MOTO🥵😈", "36"));
      console.log(color("║  BROTHER'S      : MOTO X KRIX", "35"));
      console.log(color("║  WH9TS9P  : +918708332050", "32"));
      console.log(color("╚═════════════════════════════════════════════════════════════╝", "33"));
    };

    // Enhanced connection manager with retry logic
    class WhatsAppConnectionManager {
      constructor() {
        this.sock = null;
        this.retryCount = 0;
        this.maxRetries = 10;
        this.retryDelay = 5000;
        this.isConnected = false;
        this.connectionTimeout = null;
        this.pingInterval = null;
      }

      async initialize() {
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(color(`[INFO] Using WA v${version.join('.')}, isLatest: ${isLatest}`, "36"));

        const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

        // Enhanced socket configuration
        const sockConfig = {
          version,
          logger: pino({ level: "silent" }),
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
          },
          browser: ['Termux', 'Chrome', '1.0.0'],
          connectTimeoutMs: 60000,
          keepAliveIntervalMs: 25000,
          qrTimeout: 60000,
          defaultQueryTimeoutMs: 60000,
          retryRequestDelayMs: 1000,
          maxRetries: 5,
          generateHighQualityLinkPreview: true,
          syncFullHistory: false,
          markOnlineOnConnect: true,
          fireInitQueries: true,
          getMessage: async (key) => {
            // Message store implementation
            return { conversation: '' };
          }
        };

        this.sock = makeWASocket(sockConfig);
        
        this.setupEventHandlers(saveCreds);
        return this.sock;
      }

      setupEventHandlers(saveCreds) {
        // Connection update handler with enhanced reconnect logic
        this.sock.ev.on("connection.update", async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            console.log(color("[QR CODE] Scan this QR code with WhatsApp:", "33"));
            console.log(qr);
          }

          if (connection === "open") {
            this.isConnected = true;
            this.retryCount = 0;
            console.log(color("[SUCCESS] Connected to WhatsApp!", "32"));
            
            // Start keep-alive ping
            this.startKeepAlive();
          }

          if (connection === "close") {
            this.isConnected = false;
            this.stopKeepAlive();
            
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (statusCode === DisconnectReason.loggedOut) {
              console.log(color("[ERROR] Device logged out. Please delete auth_info folder and restart.", "31"));
              process.exit(1);
            } else if (shouldReconnect && this.retryCount < this.maxRetries) {
              this.retryCount++;
              const backoffDelay = this.retryDelay * Math.pow(2, this.retryCount - 1);
              console.log(color(`[RECONNECT] Attempt ${this.retryCount}/${this.maxRetries} in ${backoffDelay/1000}s...`, "33"));
              
              await delay(backoffDelay);
              try {
                await this.initialize();
              } catch (error) {
                console.log(color(`[ERROR] Reconnection failed: ${error.message}`, "31"));
              }
            } else if (this.retryCount >= this.maxRetries) {
              console.log(color("[ERROR] Max reconnection attempts reached. Please restart manually.", "31"));
              process.exit(1);
            }
          }
        });

        // Credentials update handler
        this.sock.ev.on("creds.update", saveCreds);

        // Message handling
        this.sock.ev.on("messages.upsert", async (m) => {
          // Handle incoming messages if needed
        });

        // Connection error handler
        this.sock.ev.on("connection.error", (error) => {
          console.log(color(`[ERROR] Connection error: ${error.message}`, "31"));
        });
      }

      startKeepAlive() {
        this.stopKeepAlive();
        this.pingInterval = setInterval(async () => {
          try {
            if (this.sock?.user) {
              await this.sock.sendPresenceUpdate('available');
            }
          } catch (error) {
            console.log(color("[WARNING] Keep-alive ping failed", "33"));
          }
        }, 30000);
      }

      stopKeepAlive() {
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
      }

      async waitForConnection(timeout = 120000) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, timeout);

          const checkConnection = setInterval(() => {
            if (this.isConnected && this.sock?.user) {
              clearTimeout(timer);
              clearInterval(checkConnection);
              resolve();
            }
          }, 1000);
        });
      }

      async safeSendMessage(jid, content, retries = 3) {
        for (let i = 0; i < retries; i++) {
          try {
            if (!this.isConnected) {
              await delay(2000);
              continue;
            }
            
            const result = await this.sock.sendMessage(jid, content);
            return result;
          } catch (error) {
            if (i === retries - 1) throw error;
            await delay(2000 * (i + 1));
          }
        }
      }
    }

    // Message sender with rate limiting and error recovery
    class MessageSender {
      constructor(sock, connectionManager) {
        this.sock = sock;
        this.cm = connectionManager;
        this.messageQueue = [];
        this.isSending = false;
        this.rateLimitDelay = 1000;
        this.failedMessages = [];
      }

      async sendMessages(targets, message, delay) {
        for (const target of targets) {
          try {
            const jid = target.includes('@g.us') ? target : `${target}@s.whatsapp.net`;
            await this.cm.safeSendMessage(jid, { text: message });
            console.log(color(`[SENT] Message sent to: ${target}`, "32"));
            await delay(delay * 1000);
          } catch (error) {
            console.log(color(`[ERROR] Failed to send to ${target}: ${error.message}`, "31"));
            this.failedMessages.push(target);
            await delay(5000);
          }
        }

        // Retry failed messages
        if (this.failedMessages.length > 0) {
          console.log(color(`[RETRY] Retrying ${this.failedMessages.length} failed messages...`, "33"));
          await delay(10000);
          
          for (const target of this.failedMessages) {
            try {
              const jid = target.includes('@g.us') ? target : `${target}@s.whatsapp.net`;
              await this.cm.safeSendMessage(jid, { text: message });
              console.log(color(`[RETRY] Successfully sent to: ${target}`, "32"));
            } catch (error) {
              console.log(color(`[FAILED] Could not send to: ${target}`, "31"));
            }
            await delay(delay * 1000);
          }
        }
      }
    }

    // Auto status viewer
    const setupAutoStatusView = (sock) => {
      sock.ev.on("presence.update", async (presence) => {
        if (presence.status === "available") {
          const chat = presence.id.split("@")[0];
          try {
            await sock.sendPresenceUpdate('available', chat + "@s.whatsapp.net");
          } catch (error) {
            // Silently ignore status view errors
          }
        }
      });
    };

    // Main execution function
    const main = async () => {
      showBanner();
      
      // Generate device key
      const deviceKey = crypto.createHash("sha256")
        .update(os.platform() + os.userInfo().username)
        .digest("hex");
      
      console.log(color(`[KEY] Your device key: ${deviceKey}`, "36"));
      console.log(color("[INFO] Initializing connection...", "37"));

      // Initialize connection manager
      const cm = new WhatsAppConnectionManager();
      const sock = await cm.initialize();

      if (!sock.authState.creds.registered) {
        showBanner();
        const phoneNumber = await question(color("[+] ENTER YOUR PHONE NUMBER (with country code): ", "36"));
        
        try {
          const code = await sock.requestPairingCode(phoneNumber);
          showBanner();
          console.log(color(`[PAIRING CODE] Your code: ${code}`, "31"));
          console.log(color("[INFO] Enter this code in WhatsApp to connect", "32"));
        } catch (error) {
          console.log(color(`[ERROR] Failed to get pairing code: ${error.message}`, "31"));
          process.exit(1);
        }
      }

      // Wait for connection
      try {
        await cm.waitForConnection();
        console.log(color("[SUCCESS] WhatsApp connected successfully!", "32"));
      } catch (error) {
        console.log(color("[ERROR] Connection timeout. Please check your internet.", "31"));
        process.exit(1);
      }

      showBanner();

      // Get user preferences
      const option = await question(color("[1] SEND TO TARGET NUMBER\n[2] SEND TO WHATSAPP GROUP\nCHOOSE OPTION => ", "36"));
      
      let targets = [];

      if (option === '1') {
        const targetCount = parseInt(await question(color("[+] HOW MANY TARGET NUMBERS? => ", "32")));
        
        for (let i = 0; i < targetCount; i++) {
          const target = await question(color(`[+] ENTER TARGET NUMBER ${i + 1} (with country code): `, "34"));
          targets.push(target);
        }
      } else if (option === '2') {
        try {
          const groups = await sock.groupFetchAllParticipating();
          const groupIds = Object.keys(groups);
          
          console.log(color("[GROUPS] Available WhatsApp Groups:", "33"));
          groupIds.forEach((id, index) => {
            console.log(color(`[${index + 1}] ${groups[id].subject} [UID: ${id}]`, "34"));
          });
          
          const groupCount = parseInt(await question(color("[+] HOW MANY GROUPS TO TARGET => ", "35")));
          
          for (let i = 0; i < groupCount; i++) {
            const groupUid = await question(color(`[+] ENTER GROUP UID ${i + 1}: `, "36"));
            targets.push(groupUid);
          }
        } catch (error) {
          console.log(color(`[ERROR] Failed to fetch groups: ${error.message}`, "31"));
          process.exit(1);
        }
      }

      const messageFile = await question(color("[+] ENTER MESSAGE FILE PATH: ", "37"));
      
      if (!fs.existsSync(messageFile)) {
        console.log(color("[ERROR] Message file not found!", "31"));
        process.exit(1);
      }

      const messages = fs.readFileSync(messageFile, "utf-8").split("\n").filter(Boolean);
      const haterName = await question(color("[+] ENTER HATER NAME: ", "32"));
      const messageDelay = parseInt(await question(color("[+] ENTER MESSAGE DELAY (in seconds): ", "34")));

      // Setup auto status view
      setupAutoStatusView(sock);

      // Start sending messages
      const sender = new MessageSender(sock, cm);
      
      console.log(color("[INFO] Starting message sending...", "36"));
      
      // Continuous sending loop
      while (cm.isConnected) {
        for (const msg of messages) {
          if (!cm.isConnected) break;
          
          const formattedMessage = `${haterName} ${msg}`;
          const currentTime = new Date().toLocaleTimeString();
          
          console.log(color(`[TIME] ${currentTime}`, "34"));
          console.log(color(`[MESSAGE] ${formattedMessage}`, "35"));
          console.log(color("[====================]", "37"));
          
          await sender.sendMessages(targets, formattedMessage, messageDelay);
        }
      }
    };

    // Graceful shutdown
    const cleanup = () => {
      console.log(color("\n[INFO] Shutting down gracefully...", "33"));
      readline.close();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', (error) => {
      console.log(color(`[FATAL ERROR] ${error.message}`, "31"));
      cleanup();
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.log(color(`[UNHANDLED REJECTION] ${reason}`, "31"));
    });

    // Start the application
    await main();

  } catch (error) {
    console.error(color(`[CRITICAL ERROR] ${error.message}`, "31"));
    console.error(error.stack);
    process.exit(1);
  }
})();
