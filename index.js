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
╠══════════════════════════════════════════════════════════════╣
║  🎯 OWNER    : ${chalk.magenta('KRIX GOD')}                                        ║
║  🔥 TOOL     : ${chalk.green('ULTIMATE WHATSAPP BOMBER')}                              ║
║  💀 VERSION  : ${chalk.yellow('7.0.0 - FULL WORKING')}                                 ║
║  ⚡ STATUS   : ${chalk.cyan('READY 🔥')}                                             ║
╚══════════════════════════════════════════════════════════════╝
      `));
    };
    
    let targets = [];
    let groups = [];
    let messages = [];
    let delay = 2;
    let senderName = "";
    let totalSent = 0;
    
    // ========== MAIN FUNCTION ==========
    const start = async () => {
      // Initialize auth state - FIXED: yeh variable pehle missing tha
      const { state, saveCreds } = await _0x43d940("./auth_info");
      
      const sock = _0x4f98c4({
        logger: _0x3381b6({ level: "silent" }),
        auth: state,
        browser: ['KRIX BOMBER', 'Chrome', '120.0.0.0'],
        printQRInTerminal: true
      });
      
      // Handle connection
      sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        
        if (qr) {
          console.log(chalk.yellow('\n[📱] SCAN QR CODE:\n'));
          console.log(chalk.white(qr));
        }
        
        if (connection === 'open') {
          console.log(chalk.green('\n[✅] WHATSAPP CONNECTED!\n'));
          await menu(sock);
        }
        
        if (connection === 'close') {
          console.log(chalk.yellow('\n[🔄] RECONNECTING...\n'));
          setTimeout(start, 5000);
        }
      });
      
      sock.ev.on('creds.update', saveCreds);
      
      // Check if already authenticated
      if (!state.creds.registered) {
        _0x1e9ef5();
        console.log(chalk.yellow('\n[🔐] NEW SESSION - SCAN QR CODE ABOVE\n'));
      } else {
        console.log(chalk.green('\n[✅] SESSION LOADED!\n'));
      }
    };
    
    // ========== MENU SYSTEM ==========
    async function menu(sock) {
      while (true) {
        _0x1e9ef5();
        console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════╗
║  📋 ${chalk.white('MAIN MENU')}                                            ║
╠════════════════════════════════════════════════════════╣
║  ${chalk.green('[1]')} 🎯 ADD TARGET NUMBERS                               ║
║  ${chalk.green('[2]')} 👥 ADD GROUP TARGETS                                ║
║  ${chalk.green('[3]')} 📝 LOAD MESSAGE FILE                                ║
║  ${chalk.green('[4]')} ⚙️  SETTINGS (Delay/Sender Name)                    ║
║  ${chalk.green('[5]')} 📊 SHOW STATUS                                      ║
║  ${chalk.green('[6]')} 🚀 START BOMBING                                    ║
║  ${chalk.green('[7]')} ❌ EXIT                                             ║
╚════════════════════════════════════════════════════════╝
        `));
        
        const choice = await _0x3e09d7(chalk.cyan('[?] SELECT OPTION: '));
        
        switch(choice) {
          case '1':
            const numCount = await _0x3e09d7(chalk.cyan('[+] HOW MANY NUMBERS: '));
            for (let i = 0; i < numCount; i++) {
              const num = await _0x3e09d7(chalk.green(`[+] NUMBER ${i+1} (e.g., 91XXXXXXXXXX): `));
              targets.push(num);
            }
            console.log(chalk.green(`\n[✅] ${targets.length} NUMBERS ADDED\n`));
            await _0x2bedd9(1500);
            break;
            
          case '2':
            try {
              const groupList = await sock.groupFetchAllParticipating();
              const groupIds = Object.keys(groupList);
              console.log(chalk.yellow('\n📋 YOUR GROUPS:\n'));
              groupIds.forEach((id, idx) => {
                console.log(chalk.cyan(`  ${idx+1}. ${groupList[id].subject}`));
                console.log(chalk.dim(`     ID: ${id}\n`));
              });
              const grpCount = await _0x3e09d7(chalk.cyan('[+] HOW MANY GROUPS TO TARGET: '));
              for (let i = 0; i < grpCount; i++) {
                const gid = await _0x3e09d7(chalk.green(`[+] GROUP ID ${i+1}: `));
                groups.push(gid);
              }
              console.log(chalk.green(`\n[✅] ${groups.length} GROUPS ADDED\n`));
            } catch(e) {
              console.log(chalk.red(`\n[❌] ERROR: ${e.message}\n`));
            }
            await _0x2bedd9(1500);
            break;
            
          case '3':
            const msgPath = await _0x3e09d7(chalk.cyan('[📝] MESSAGE FILE PATH: '));
            try {
              const content = _0x5f1924.readFileSync(msgPath, "utf-8");
              messages = content.split("\n").filter(line => line.trim());
              console.log(chalk.green(`\n[✅] LOADED ${messages.length} MESSAGES\n`));
            } catch(e) {
              console.log(chalk.red(`\n[❌] FILE ERROR: ${e.message}\n`));
            }
            await _0x2bedd9(1500);
            break;
            
          case '4':
            console.log(chalk.cyan('\n⚙️ CURRENT SETTINGS:\n'));
            console.log(chalk.dim(`  DELAY: ${delay} seconds`));
            console.log(chalk.dim(`  SENDER NAME: ${senderName || 'NOT SET'}`));
            const newDelay = await _0x3e09d7(chalk.cyan('[+] NEW DELAY (seconds): '));
            if (newDelay && !isNaN(newDelay)) delay = parseInt(newDelay);
            const newName = await _0x3e09d7(chalk.cyan('[+] SENDER NAME: '));
            if (newName) senderName = newName;
            console.log(chalk.green('\n[✅] SETTINGS UPDATED\n'));
            await _0x2bedd9(1500);
            break;
            
          case '5':
            console.log(chalk.cyan('\n📊 CURRENT STATUS:\n'));
            console.log(chalk.white(`  TARGET NUMBERS: ${targets.length}`));
            console.log(chalk.white(`  TARGET GROUPS: ${groups.length}`));
            console.log(chalk.white(`  MESSAGES LOADED: ${messages.length}`));
            console.log(chalk.white(`  DELAY: ${delay}s`));
            console.log(chalk.white(`  SENDER: ${senderName || 'N/A'}`));
            console.log(chalk.white(`  TOTAL SENT: ${totalSent}`));
            console.log(chalk.dim('\n[⚡] PRESS ENTER TO CONTINUE...'));
            await _0x3e09d7('');
            break;
            
          case '6':
            if (targets.length === 0 && groups.length === 0) {
              console.log(chalk.red('\n[❌] NO TARGETS! ADD NUMBERS OR GROUPS FIRST.\n'));
              await _0x2bedd9(1500);
              break;
            }
            if (messages.length === 0) {
              console.log(chalk.red('\n[❌] NO MESSAGES! LOAD MESSAGE FILE FIRST.\n'));
              await _0x2bedd9(1500);
              break;
            }
            await startBombing(sock);
            break;
            
          case '7':
            console.log(chalk.red('\n[❌] EXITING...\n'));
            process.exit(0);
            
          default:
            console.log(chalk.red('\n[❌] INVALID OPTION!\n'));
            await _0x2bedd9(1000);
        }
      }
    }
    
    // ========== BOMBING FUNCTION ==========
    async function startBombing(sock) {
      _0x1e9ef5();
      console.log(chalk.yellow('\n[🔥] STARTING BOMBING...\n'));
      await _0x2bedd9(2000);
      
      while (true) {
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const fullMsg = `${senderName ? senderName + ' ' : ''}${msg}`;
          
          // Send to numbers
          for (const num of targets) {
            try {
              await sock.sendMessage(num + "@c.us", { text: fullMsg });
              totalSent++;
              console.log(chalk.green(`[✅] SENT TO: ${num}`));
            } catch(e) {
              console.log(chalk.red(`[❌] FAILED: ${num} - ${e.message}`));
            }
          }
          
          // Send to groups
          for (const grp of groups) {
            try {
              await sock.sendMessage(grp + "@g.us", { text: fullMsg });
              totalSent++;
              console.log(chalk.green(`[✅] SENT TO GROUP: ${grp.substring(0,15)}...`));
            } catch(e) {
              console.log(chalk.red(`[❌] FAILED GROUP: ${e.message}`));
            }
          }
          
          console.log(chalk.cyan(`
╔════════════════════════════════════════════════════╗
║  💀 ${chalk.red('KRIX BOMBER')} 💀                                         ║
║  📨 MSG ${i+1}/${messages.length}                                       ║
║  💬 TOTAL SENT: ${totalSent}                                            ║
║  ⏱️  NEXT IN: ${delay}s                                               ║
╚════════════════════════════════════════════════════╝
          `));
          
          await _0x2bedd9(delay * 1000);
        }
        
        console.log(chalk.green('\n[🔄] CYCLE COMPLETE! RESTARTING...\n'));
        await _0x2bedd9(3000);
      }
    }
    
    // Start the application
    console.log(chalk.green('\n[✨] KRIX BOMBER v7.0 STARTING...\n'));
    await _0x2bedd9(2000);
    start();
    
  } catch (error) {
    console.error('\n[💀] FATAL ERROR: ' + error + '\n');
    console.log('Run: npm install @whiskeysockets/baileys chalk pino\n');
  }
})();
