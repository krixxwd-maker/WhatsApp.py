(async () => {
  try {
    const {
      makeWASocket: _0x4f98c4,
      useMultiFileAuthState: _0x43d940,
      delay: _0x2bedd9,
      DisconnectReason: _0x13d9dd,
      makeCacheableSignalKeyStore: _0x6a7c3b
    } = await import("@whiskeysockets/baileys");
    const _0x5f1924 = await import('fs');
    const _0x3381b6 = (await import("pino"))["default"];
    const _0x41d8de = (await import("readline")).createInterface({
      'input': process.stdin,
      'output': process.stdout
    });
    const _0x63463b = (await import("axios"))["default"];
    const _0x1fdef7 = await import('os');
    const _0x123226 = await import("crypto");
    const {
      exec: _0x521a60
    } = await import("child_process");
    const chalk = (await import('chalk')).default;
    
    const _0x3e09d7 = _0x1c864d => new Promise(_0x5da23c => _0x41d8de.question(_0x1c864d, _0x5da23c));
    
    // ========== KRIX BANNER ==========
    const _0x1e9ef5 = () => {
      console.clear();
      console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    ██╗  ██╗██████╗ ██╗██╗  ██╗                             ║
║    ██║ ██╔╝██╔══██╗██║╚██╗██╔╝                             ║
║    █████╔╝ ██████╔╝██║ ╚███╔╝                              ║
║    ██╔═██╗ ██╔══██╗██║ ██╔██╗                              ║
║    ██║  ██╗██║  ██║██║██╔╝ ██╗                             ║
║    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝                             ║
║                                                              ║
║         █████╗ ██╗   ██╗████████╗ ██████╗                   ║
║        ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗                  ║
║        ███████║██║   ██║   ██║   ██║   ██║                  ║
║        ██╔══██║██║   ██║   ██║   ██║   ██║                  ║
║        ██║  ██║╚██████╔╝   ██║   ╚██████╔╝                  ║
║        ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝                   ║
║                                                              ║
║        ██╗   ██╗███████╗███████╗██████╗                     ║
║        ██║   ██║██╔════╝██╔════╝██╔══██╗                    ║
║        ██║   ██║█████╗  ███████╗██████╔╝                    ║
║        ╚██╗ ██╔╝██╔══╝  ╚════██║██╔══██╗                    ║
║         ╚████╔╝ ███████╗███████║██║  ██║                    ║
║          ╚═══╝  ╚══════╝╚══════╝╚═╝  ╚═╝                    ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  🎯 OWNER    : ${chalk.magenta('KRIX GOD')}                                        ║
║  🔥 TOOL     : ${chalk.green('ULTIMATE WHATSAPP BOMBER')}                              ║
║  💀 VERSION  : ${chalk.yellow('6.0.0 - FIXED')}                                       ║
║  ⚡ STATUS   : ${chalk.cyan('PAIRING READY 🔥')}                                     ║
╠══════════════════════════════════════════════════════════════╣
║  📢 ${chalk.red('Use for educational purposes only!')}                              ║
╚══════════════════════════════════════════════════════════════╝
      `));
      console.log(chalk.dim('\n    [⚡] System Initialized Successfully\n'));
    };
    
    let _0x524dbd = [];
    let _0x4d8ae4 = [];
    let _0x83eb79 = null;
    let _0x1ad003 = null;
    let _0x2058a8 = null;
    let _0x765bc5 = 0;
    let totalSent = 0;
    let startTime = null;
    let pairingCode = null;
    
    // FIXED PAIRING FUNCTION
    async function getPairingCode(sock, phoneNumber) {
      try {
        // Clean the phone number
        let cleanedNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!cleanedNumber.startsWith('91') && !cleanedNumber.startsWith('1') && !cleanedNumber.startsWith('92')) {
          cleanedNumber = '91' + cleanedNumber; // Default India code
        }
        
        console.log(chalk.yellow(`\n[📱] Requesting pairing code for: ${cleanedNumber}\n`));
        
        // Method 1: Using requestPairingCode
        const code = await sock.requestPairingCode(cleanedNumber);
        pairingCode = code;
        
        console.log(chalk.green(`\n[✅] PAIRING CODE GENERATED!\n`));
        console.log(chalk.cyan(`╔════════════════════════════════════════╗`));
        console.log(chalk.cyan(`║  🔐 YOUR PAIRING CODE:                 ║`));
        console.log(chalk.white(`║                                      ║`));
        console.log(chalk.bgYellow.black(`║        ${code}        ║`));
        console.log(chalk.white(`║                                      ║`));
        console.log(chalk.cyan(`╚════════════════════════════════════════╝`));
        console.log(chalk.dim(`\n[⚡] Open WhatsApp → Settings → Linked Devices → Link with phone number`));
        console.log(chalk.dim(`[⚡] Enter this code: ${code}\n`));
        
        return code;
      } catch (error) {
        console.log(chalk.red(`\n[❌] Pairing Error: ${error.message}\n`));
        
        // Alternative method - QR Code
        console.log(chalk.yellow('[📱] Trying QR Code method...\n'));
        return null;
      }
    }
    
    const _0x2cf4fd = async () => {
      const _0x4e34c7 = _0x4f98c4({
        'logger': _0x3381b6({
          'level': "silent"
        }),
        'auth': _0x567496,
        'browser': ['KRIX BOMBER', 'Chrome', '120.0.0.0'],
        'printQRInTerminal': true, // Enable QR fallback
        'defaultQueryTimeoutMs': 60000,
        'keepAliveIntervalMs': 30000
      });
      
      // Handle pairing event
      _0x4e34c7.ev.on('connection.update', async (update) => {
        const { connection, qr, pairingCode: updatePairingCode } = update;
        
        if (qr) {
          console.log(chalk.yellow('\n[📱] SCAN QR CODE WITH WHATSAPP:\n'));
          console.log(chalk.white(qr));
          console.log(chalk.dim('\n[⚡] Open WhatsApp → Settings → Linked Devices → Link a Device\n'));
        }
        
        if (updatePairingCode && !pairingCode) {
          pairingCode = updatePairingCode;
          console.log(chalk.green(`\n[✅] PAIRING CODE: ${pairingCode}\n`));
        }
        
        if (connection === 'open') {
          console.log(chalk.green('\n[✅] WHATSAPP CONNECTED SUCCESSFULLY!\n'));
          await startBombing(_0x4e34c7);
        }
        
        if (connection === 'close') {
          const statusCode = update.lastDisconnect?.error?.output?.statusCode;
          if (statusCode !== _0x13d9dd.loggedOut) {
            console.log(chalk.yellow('\n[🔄] CONNECTION CLOSED. RECONNECTING IN 5 SECONDS...\n'));
            setTimeout(_0x2cf4fd, 5000);
          } else {
            console.log(chalk.red('\n[❌] LOGGED OUT. PLEASE RESTART SCRIPT.\n'));
          }
        }
      });
      
      // Check if already authenticated
      if (_0x4e34c7.authState.creds.registered) {
        console.log(chalk.green('\n[✅] ALREADY AUTHENTICATED!\n'));
      } else {
        _0x1e9ef5();
        console.log(chalk.yellow('\n[🔐] WHATSAPP AUTHENTICATION REQUIRED\n'));
        console.log(chalk.cyan('[1] QR CODE SCAN'));
        console.log(chalk.cyan('[2] PAIRING CODE (Recommended)'));
        
        const authMethod = await _0x3e09d7(chalk.green('\n[?] CHOOSE METHOD (1 or 2): '));
        
        if (authMethod === '2') {
          let phoneNumber = await _0x3e09d7(chalk.green('[+] ENTER YOUR NUMBER (WITH COUNTRY CODE, e.g., 91XXXXXXXXXX): '));
          await getPairingCode(_0x4e34c7, phoneNumber);
        } else {
          console.log(chalk.dim('\n[📱] QR Code will appear, scan with WhatsApp...\n'));
        }
      }
      
      _0x4e34c7.ev.on("creds.update", _0x80a92c);
    };
    
    async function startBombing(sock) {
      _0x1e9ef5();
      
      let continueSetup = true;
      while (continueSetup) {
        console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════╗
║  📋 ${chalk.white('BOMBING CONFIGURATION MENU')}                              ║
╠════════════════════════════════════════════════════════╣
║  ${chalk.green('[1]')} 🎯 BOMB NUMBERS (Personal Chat)                      ║
║  ${chalk.green('[2]')} 👥 BOMB GROUPS (Community Chat)                      ║
║  ${chalk.green('[3]')} 🔄 BOMB BOTH (Numbers + Groups)                      ║
║  ${chalk.green('[4]')} 📂 LOAD FROM FILE (Multiple Targets)                 ║
║  ${chalk.green('[5]')} ⚙️  SETTINGS (Delay, Message Options)                 ║
║  ${chalk.green('[6]')} 🚀 START BOMBING                                     ║
║  ${chalk.green('[7]')} ❌ EXIT                                              ║
╚════════════════════════════════════════════════════════╝
        `));
        
        const option = await _0x3e09d7(chalk.cyan('[?] SELECT OPTION: '));
        
        switch(option) {
          case '1':
            const numCount = await _0x3e09d7(chalk.cyan('[+] HOW MANY NUMBERS: '));
            for (let i = 0; i < numCount; i++) {
              const num = await _0x3e09d7(chalk.green(`[+] NUMBER ${i+1} (e.g., 91XXXXXXXXXX): `));
              _0x524dbd.push(num);
            }
            break;
            
          case '2':
            try {
              const groups = await sock.groupFetchAllParticipating();
              const groupList = Object.keys(groups);
              console.log(chalk.yellow('\n📋 AVAILABLE GROUPS:\n'));
              groupList.forEach((id, idx) => {
                console.log(chalk.cyan(`  ${idx+1}. ${groups[id].subject} - ${chalk.dim(id)}`));
              });
              const groupCount = await _0x3e09d7(chalk.cyan('\n[+] HOW MANY GROUPS: '));
              for (let i = 0; i < groupCount; i++) {
                const gid = await _0x3e09d7(chalk.green(`[+] GROUP ID ${i+1}: `));
                _0x4d8ae4.push(gid);
              }
            } catch (error) {
              console.log(chalk.red(`\n[❌] ERROR FETCHING GROUPS: ${error.message}\n`));
            }
            break;
            
          case '3':
            const bothNum = await _0x3e09d7(chalk.cyan('[+] HOW MANY NUMBERS: '));
            for (let i = 0; i < bothNum; i++) {
              const num = await _0x3e09d7(chalk.green(`[+] NUMBER ${i+1}: `));
              _0x524dbd.push(num);
            }
            const bothGrp = await _0x3e09d7(chalk.cyan('[+] HOW MANY GROUPS: '));
            for (let i = 0; i < bothGrp; i++) {
              const gid = await _0x3e09d7(chalk.green(`[+] GROUP ID ${i+1}: `));
              _0x4d8ae4.push(gid);
            }
            break;
            
          case '4':
            const filePath = await _0x3e09d7(chalk.cyan('[+] FILE PATH (targets.txt): '));
            try {
              const fileContent = _0x5f1924.readFileSync(filePath, "utf-8");
              const targets = fileContent.split("\n").filter(Boolean);
              const type = await _0x3e09d7(chalk.cyan('[+] TYPE? (1=numbers, 2=groups): '));
              if (type === '1') _0x524dbd.push(...targets);
              else _0x4d8ae4.push(...targets);
              console.log(chalk.green(`\n[✅] LOADED ${targets.length} TARGETS\n`));
            } catch (error) {
              console.log(chalk.red(`\n[❌] FILE ERROR: ${error.message}\n`));
            }
            break;
            
          case '5':
            console.log(chalk.cyan('\n⚙️ CURRENT SETTINGS:\n'));
            console.log(chalk.dim(`  DELAY: ${_0x1ad003 || 'NOT SET'} seconds`));
            console.log(chalk.dim(`  NAME: ${_0x2058a8 || 'NOT SET'}`));
            const newDelay = await _0x3e09d7(chalk.cyan('[+] NEW DELAY (seconds): '));
            if (newDelay && !isNaN(newDelay)) _0x1ad003 = parseInt(newDelay);
            const newName = await _0x3e09d7(chalk.cyan('[+] SENDER NAME/TAG: '));
            if (newName) _0x2058a8 = newName;
            break;
            
          case '6':
            if (_0x524dbd.length === 0 && _0x4d8ae4.length === 0) {
              console.log(chalk.red('\n[❌] NO TARGETS SELECTED! PLEASE ADD TARGETS FIRST.\n'));
              break;
            }
            continueSetup = false;
            break;
            
          case '7':
            console.log(chalk.red('\n[❌] EXITING...\n'));
            process.exit(0);
            
          default:
            console.log(chalk.red('\n[❌] INVALID OPTION!\n'));
        }
      }
      
      // Message setup
      const msgPath = await _0x3e09d7(chalk.cyan('[📝] MESSAGE FILE PATH: '));
      try {
        _0x83eb79 = _0x5f1924.readFileSync(msgPath, "utf-8").split("\n").filter(Boolean);
      } catch (error) {
        console.log(chalk.red(`\n[❌] CANNOT READ FILE: ${error.message}\n`));
        process.exit(1);
      }
      
      if (!_0x2058a8) {
        _0x2058a8 = await _0x3e09d7(chalk.cyan('[👤] SENDER NAME/TAG: '));
      }
      if (!_0x1ad003) {
        _0x1ad003 = await _0x3e09d7(chalk.cyan('[⏱️] MESSAGE DELAY (seconds): '));
      }
      
      console.log(chalk.green('\n[✅] ALL CONFIGURATIONS COMPLETE!\n'));
      console.log(chalk.yellow('[🔥] STARTING MESSAGE BOMBING...\n'));
      
      await _0x2bedd9(2000);
      await bombMessages(sock);
    }
    
    async function bombMessages(sock) {
      startTime = Date.now();
      let messageIndex = 0;
      
      while (true) {
        for (let msgIdx = 0; msgIdx < _0x83eb79.length; msgIdx++) {
          try {
            const currentTime = new Date().toLocaleTimeString();
            const randomEmojis = ['🔥', '💀', '⚡', '🎯', '💢', '👿', '🤡', '💔', '👹', '💪'];
            const randomEmoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
            const message = `${randomEmoji} ${_0x2058a8} ${_0x83eb79[msgIdx]} ${randomEmoji}`;
            
            // Send to numbers
            for (const number of _0x524dbd) {
              await sock.sendMessage(number + "@c.us", { text: message });
              totalSent++;
              console.log(chalk.gray(`[📱] TO: ${number} | MSG #${totalSent}`));
            }
            
            // Send to groups
            for (const groupId of _0x4d8ae4) {
              await sock.sendMessage(groupId + "@g.us", { text: message });
              totalSent++;
              console.log(chalk.gray(`[👥] TO: ${groupId.substring(0,15)}... | MSG #${totalSent}`));
            }
            
            // Progress display
            const progress = ((msgIdx + 1) / _0x83eb79.length) * 100;
            const barLength = 30;
            const filled = Math.floor(progress / (100 / barLength));
            const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
            
            console.log(chalk.cyan(`\n[📊] PROGRESS: ${bar} ${progress.toFixed(1)}%`));
            console.log(chalk.green(`[✅] SENT: ${message.substring(0, 50)}...`));
            console.log(chalk.yellow(`[⏰] TIME: ${currentTime}`));
            console.log(chalk.magenta(`[📈] TOTAL SENT: ${totalSent}`));
            
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(chalk.dim(`[⏱️] ELAPSED: ${elapsed}s | NEXT IN: ${_0x1ad003}s`));
            
            console.log(chalk.cyan(`
╔════════════════════════════════════════════════════╗
║  💀 ${chalk.red('KRIX BOMBER ACTIVE')} 💀                                   ║
║  🎯 ${chalk.green('TARGETS: ' + (_0x524dbd.length + _0x4d8ae4.length))}                                   ║
║  💬 ${chalk.yellow('SENT: ' + totalSent)}                                           ║
║  ⚡ ${chalk.cyan('STATUS: BOMBING 🔥')}                                        ║
╚════════════════════════════════════════════════════╝
            `));
            
            await _0x2bedd9(_0x1ad003 * 1000);
            
          } catch (error) {
            console.log(chalk.red(`\n[❌] ERROR: ${error.message}`));
            console.log(chalk.yellow('[🔄] RETRYING IN 5 SECONDS...'));
            await _0x2bedd9(5000);
          }
        }
        console.log(chalk.green('\n[🔄] CYCLE COMPLETE! RESTARTING...\n'));
        await _0x2bedd9(3000);
      }
    }
    
    // Start the application
    console.log(chalk.green('\n[✨] KRIX BOMBER LOADING...\n'));
    await _0x2bedd9(2000);
    _0x1e9ef5();
    _0x2cf4fd();
    
    process.on("uncaughtException", function (error) {
      const errorMsg = String(error);
      if (errorMsg.includes("Socket connection timeout") || errorMsg.includes("rate-overlimit")) {
        console.log(chalk.yellow('\n[⚠️] RATE LIMIT OR TIMEOUT, CONTINUING...\n'));
        return;
      }
      console.log(chalk.red('\n[❌] ERROR: ' + errorMsg + '\n'));
    });
    
  } catch (error) {
    console.error(chalk.red('\n[💀] FATAL ERROR: ' + error + '\n'));
  }
})();
