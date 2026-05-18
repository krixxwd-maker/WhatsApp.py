(async () => {
  try {
    const {
      makeWASocket: _0x4f98c4,
      useMultiFileAuthState: _0x43d940,
      delay: _0x2bedd9,
      DisconnectReason: _0x13d9dd
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
║  💀 VERSION  : ${chalk.yellow('5.0.0 - PRO MAX')}                                       ║
║  ⚡ STATUS   : ${chalk.cyan('READY TO DESTROY 🔥')}                                     ║
╠══════════════════════════════════════════════════════════════╣
║  📢 ${chalk.red('WARNING: Use for educational purposes only!')}                        ║
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
    
    const {
      state: _0x567496,
      saveCreds: _0x80a92c
    } = await _0x43d940("./auth_info");
    
    // Enhanced message sending with progress bar
    async function _0x1fa6d2(_0x57d012) {
      startTime = Date.now();
      while (true) {
        for (let _0x281a84 = _0x765bc5; _0x281a84 < _0x83eb79.length; _0x281a84++) {
          try {
            const _0x7cac94 = new Date().toLocaleTimeString();
            const customTime = new Date().toLocaleString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
            
            // Random variation in message (to avoid detection)
            const randomEmojis = ['🔥', '💀', '⚡', '🎯', '💢', '👿', '🤡', '💔'];
            const randomEmoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
            const _0x1f80a0 = `${randomEmoji} ${_0x2058a8} ${_0x83eb79[_0x281a84]} ${randomEmoji}`;
            
            // Send to numbers or groups
            if (_0x524dbd.length > 0) {
              for (const _0x5ec96e of _0x524dbd) {
                await _0x57d012.sendMessage(_0x5ec96e + "@c.us", {
                  'text': _0x1f80a0
                });
                totalSent++;
                console.log(chalk.gray(`\r[📱] TARGET: ${_0x5ec96e} | MSG #${totalSent}`));
              }
            } else {
              for (const _0x4081a3 of _0x4d8ae4) {
                await _0x57d012.sendMessage(_0x4081a3 + "@g.us", {
                  'text': _0x1f80a0
                });
                totalSent++;
                console.log(chalk.gray(`\r[👥] GROUP: ${_0x4081a3.substring(0,10)}... | MSG #${totalSent}`));
              }
            }
            
            // Progress bar
            const progress = ((_0x281a84 + 1) / _0x83eb79.length) * 100;
            const barLength = 30;
            const filled = Math.floor(progress / (100 / barLength));
            const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
            
            console.log(chalk.cyan(`\n[📊] PROGRESS: ${bar} ${progress.toFixed(1)}%`));
            console.log(chalk.green(`[✅] SENT: ${_0x1f80a0}`));
            console.log(chalk.yellow(`[⏰] TIME: ${_0x7cac94}`));
            console.log(chalk.magenta(`[📈] TOTAL SENT: ${totalSent}`));
            
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(chalk.dim(`[⏱️] ELAPSED: ${elapsed}s | NEXT MSG IN: ${_0x1ad003}s`));
            
            console.log(chalk.cyan(`
╔════════════════════════════════════════════════════╗
║  💀 ${chalk.red('KRIX BOMBER ACTIVE')} 💀                                   ║
║  🎯 ${chalk.green('TARGETS DESTROYED: ' + (_0x524dbd.length || _0x4d8ae4.length))}                       ║
║  💬 ${chalk.yellow('MESSAGES SENT: ' + totalSent)}                                    ║
║  ⚡ ${chalk.cyan('STATUS: BOMBING IN PROGRESS 🔥')}                              ║
╚════════════════════════════════════════════════════╝
            `));
            
            await _0x2bedd9(_0x1ad003 * 1000);
          } catch (_0x101498) {
            console.log(chalk.red(`\n[❌] ERROR: ${_0x101498.message}`));
            console.log(chalk.yellow('[🔄] RETRYING IN 5 SECONDS...'));
            _0x765bc5 = _0x281a84;
            await _0x2bedd9(5000);
          }
        }
        _0x765bc5 = 0;
        console.log(chalk.green('\n[🔄] COMPLETED ONE CYCLE! RESTARTING BOMBING...\n'));
        await _0x2bedd9(3000);
      }
    }
    
    // Enhanced menu system
    async function showAdvancedMenu(sock) {
      console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════╗
║  📋 ${chalk.white('ADVANCED OPTIONS MENU')}                                    ║
╠════════════════════════════════════════════════════════╣
║  ${chalk.green('[1]')} 🎯 BOMB NUMBERS (Personal Chat)                      ║
║  ${chalk.green('[2]')} 👥 BOMB GROUPS (Community Chat)                      ║
║  ${chalk.green('[3]')} 🔄 BOMB BOTH (Numbers + Groups)                      ║
║  ${chalk.green('[4]')} 📂 LOAD FROM FILE (Multiple Targets)                 ║
║  ${chalk.green('[5]')} ⚙️  SETTINGS (Delay, Message Options)                 ║
║  ${chalk.green('[6]')} 📊 LIVE STATS                                        ║
║  ${chalk.green('[7]')} 🚀 START BOMBING                                     ║
║  ${chalk.green('[8]')} ❌ EXIT                                              ║
╚════════════════════════════════════════════════════════╝
      `));
      
      const choice = await _0x3e09d7(chalk.cyan('[?] SELECT OPTION: '));
      return choice;
    }
    
    const _0x2cf4fd = async () => {
      const _0x4e34c7 = _0x4f98c4({
        'logger': _0x3381b6({
          'level': "silent"
        }),
        'auth': _0x567496,
        'browser': ['KRIX BOMBER', 'Chrome', '120.0.0.0']
      });
      
      if (!_0x4e34c7.authState.creds.registered) {
        _0x1e9ef5();
        console.log(chalk.yellow('\n[🔐] WHATSAPP AUTHENTICATION REQUIRED\n'));
        const _0x13770e = await _0x3e09d7(chalk.green('[+] ENTER YOUR NUMBER (WITH COUNTRY CODE): '));
        const _0x6aed75 = await _0x4e34c7.requestPairingCode(_0x13770e);
        _0x1e9ef5();
        console.log(chalk.cyan(`\n[📱] PAIRING CODE: ${chalk.white(_0x6aed75)}\n`));
        console.log(chalk.dim('[⚡] ENTER THIS CODE IN YOUR WHATSAPP APP\n'));
      }
      
      _0x4e34c7.ev.on("connection.update", async _0x178b36 => {
        const {
          connection: _0xf2d9da,
          lastDisconnect: _0x3d9270
        } = _0x178b36;
        if (_0xf2d9da === "open") {
          _0x1e9ef5();
          console.log(chalk.green('\n[✅] WHATSAPP CONNECTED SUCCESSFULLY!\n'));
          
          let continueSetup = true;
          while (continueSetup) {
            const option = await showAdvancedMenu(_0x4e34c7);
            
            switch(option) {
              case '1':
                const numCount = await _0x3e09d7(chalk.cyan('[+] HOW MANY NUMBERS: '));
                for (let i = 0; i < numCount; i++) {
                  const num = await _0x3e09d7(chalk.green(`[+] NUMBER ${i+1}: `));
                  _0x524dbd.push(num);
                }
                break;
                
              case '2':
                const groups = await _0x4e34c7.groupFetchAllParticipating();
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
                break;
                
              case '3':
                console.log(chalk.yellow('\n[⚠️] BOTH MODE SELECTED\n'));
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
                const filePath = await _0x3e09d7(chalk.cyan('[+] FILE PATH (numbers.txt): '));
                const fileContent = _0x5f1924.readFileSync(filePath, "utf-8");
                const targets = fileContent.split("\n").filter(Boolean);
                const type = await _0x3e09d7(chalk.cyan('[+] TYPE? (1=numbers, 2=groups): '));
                if (type === '1') _0x524dbd.push(...targets);
                else _0x4d8ae4.push(...targets);
                break;
                
              case '5':
                console.log(chalk.cyan('\n⚙️ CURRENT SETTINGS:\n'));
                console.log(chalk.dim(`  DELAY: ${_0x1ad003 || 'NOT SET'} seconds`));
                console.log(chalk.dim(`  NAME: ${_0x2058a8 || 'NOT SET'}`));
                const newDelay = await _0x3e09d7(chalk.cyan('[+] NEW DELAY (seconds): '));
                if (newDelay) _0x1ad003 = parseInt(newDelay);
                const newName = await _0x3e09d7(chalk.cyan('[+] SENDER NAME: '));
                if (newName) _0x2058a8 = newName;
                break;
                
              case '6':
                console.log(chalk.cyan('\n📊 LIVE STATISTICS:\n'));
                console.log(chalk.white(`  TARGETS: ${_0x524dbd.length + _0x4d8ae4.length}`));
                console.log(chalk.white(`  MESSAGES SENT: ${totalSent}`));
                if (startTime) {
                  const runtime = ((Date.now() - startTime) / 1000).toFixed(0);
                  console.log(chalk.white(`  RUNTIME: ${Math.floor(runtime/60)}m ${runtime%60}s`));
                }
                break;
                
              case '7':
                continueSetup = false;
                break;
                
              case '8':
                console.log(chalk.red('\n[❌] EXITING...\n'));
                process.exit(0);
                
              default:
                console.log(chalk.red('\n[❌] INVALID OPTION!\n'));
            }
          }
          
          // Message setup
          const msgPath = await _0x3e09d7(chalk.cyan('[📝] MESSAGE FILE PATH: '));
          _0x83eb79 = _0x5f1924.readFileSync(msgPath, "utf-8").split("\n").filter(Boolean);
          
          if (!_0x2058a8) {
            _0x2058a8 = await _0x3e09d7(chalk.cyan('[👤] SENDER NAME/TAG: '));
          }
          if (!_0x1ad003) {
            _0x1ad003 = await _0x3e09d7(chalk.cyan('[⏱️] MESSAGE DELAY (seconds): '));
          }
          
          console.log(chalk.green('\n[✅] ALL CONFIGURATIONS COMPLETE!\n'));
          console.log(chalk.yellow('[🔥] STARTING MESSAGE BOMBING...\n'));
          
          await _0x2bedd9(2000);
          _0x1e9ef5();
          await _0x1fa6d2(_0x4e34c7);
        }
        
        if (_0xf2d9da === "close" && _0x3d9270?.["error"]) {
          const _0x291b26 = _0x3d9270.error?.["output"]?.["statusCode"] !== _0x13d9dd.loggedOut;
          if (_0x291b26) {
            console.log(chalk.yellow('\n[🔄] NETWORK ISSUE, RECONNECTING...\n'));
            setTimeout(_0x2cf4fd, 5000);
          } else {
            console.log(chalk.red('\n[❌] CONNECTION CLOSED. RESTART SCRIPT.\n'));
          }
        }
      });
      
      _0x4e34c7.ev.on("creds.update", _0x80a92c);
    };
    
    // Remove approval check - free for all
    console.log(chalk.green('\n[✨] KRIX BOMBER LOADING...\n'));
    await _0x2bedd9(2000);
    _0x1e9ef5();
    _0x2cf4fd();
    
    process.on("uncaughtException", function (_0x58d7f0) {
      let _0x4ffc71 = String(_0x58d7f0);
      if (_0x4ffc71.includes("Socket connection timeout") || _0x4ffc71.includes("rate-overlimit")) {
        console.log(chalk.yellow('\n[⚠️] RATE LIMIT HIT, COOLDOWN...\n'));
        return;
      }
      console.log(chalk.red('\n[❌] ERROR: ' + _0x58d7f0 + '\n'));
    });
    
  } catch (_0x1553e9) {
    console.error(chalk.red('\n[💀] FATAL ERROR: ' + _0x1553e9 + '\n'));
  }
})();
