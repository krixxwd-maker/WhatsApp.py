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
    
    const question = (text) => new Promise(resolve => _0x41d8de.question(text, resolve));
    
    // KRIX BANNER
    const banner = () => {
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
║  🔥 TOOL     : ${chalk.green('WHATSAPP BOMBER')}                                   ║
║  💀 VERSION  : ${chalk.yellow('7.0 - PAIRING CODE')}                               ║
║  ⚡ STATUS   : ${chalk.cyan('READY 🔥')}                                             ║
╚══════════════════════════════════════════════════════════════╝
      `));
    };
    
    let targets = [];
    let groups = [];
    let messages = [];
    let delay = 2;
    let senderName = "🔥 KRIX 🔥";
    let totalSent = 0;
    
    // ========== SIRF PAIRING CODE WALA CONNECTION ==========
    const start = async () => {
      const { state, saveCreds } = await _0x43d940("./auth_info");
      
      const sock = _0x4f98c4({
        logger: _0x3381b6({ level: "silent" }),
        auth: state,
        browser: ['KRIX BOMBER', 'Chrome', '120.0.0.0']
      });
      
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
          banner();
          console.log(chalk.green('\n[✅] WHATSAPP CONNECTED SUCCESSFULLY!\n'));
          await menu(sock);
        }
        
        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== _0x13d9dd.loggedOut;
          if (shouldReconnect) {
            console.log(chalk.yellow('\n[🔄] RECONNECTING IN 5 SECONDS...\n'));
            setTimeout(start, 5000);
          } else {
            console.log(chalk.red('\n[❌] LOGGED OUT. DELETE auth_info FOLDER AND RESTART.\n'));
          }
        }
      });
      
      sock.ev.on('creds.update', saveCreds);
      
      // SIRF PAIRING CODE - NO QR CODE
      if (!state.creds.registered) {
        banner();
        console.log(chalk.yellow('\n[🔐] PAIRING CODE REQUIRED\n'));
        const phoneNumber = await question(chalk.green('[+] ENTER YOUR NUMBER (with country code, e.g., 919876543210): '));
        
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        console.log(chalk.yellow(`\n[📱] REQUESTING PAIRING CODE FOR: ${cleanNumber}\n`));
        
        const code = await sock.requestPairingCode(cleanNumber);
        
        console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🔐 YOUR WHATSAPP PAIRING CODE 🔐                     ║
║                                                              ║
║              ${chalk.bgWhite.black(`  ${code}  `)}                    ║
║                                                              ║
║   Open WhatsApp → Settings → Linked Devices                  ║
║   → Link with phone number → Enter this code                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        `));
        
        console.log(chalk.dim('\n[⚡] WAITING FOR CONNECTION...\n'));
      } else {
        banner();
        console.log(chalk.green('\n[✅] SESSION LOADED! CONNECTING...\n'));
      }
    };
    
    // ========== MENU ==========
    async function menu(sock) {
      while (true) {
        banner();
        console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════╗
║  📋 ${chalk.white('BOMBER MENU')}                                          ║
╠════════════════════════════════════════════════════════╣
║  ${chalk.green('[1]')} 🎯 ADD TARGET NUMBERS                               ║
║  ${chalk.green('[2]')} 👥 ADD GROUP TARGETS                                ║
║  ${chalk.green('[3]')} 📝 LOAD MESSAGE FILE                                ║
║  ${chalk.green('[4]')} ⚙️  SETTINGS (Delay/Sender)                         ║
║  ${chalk.green('[5]')} 📊 SHOW STATUS                                      ║
║  ${chalk.green('[6]')} 🚀 START BOMBING                                    ║
║  ${chalk.green('[7]')} ❌ EXIT                                             ║
╚════════════════════════════════════════════════════════╝
        `));
        
        const choice = await question(chalk.cyan('[?] SELECT OPTION: '));
        
        switch(choice) {
          case '1':
            const numCount = await question(chalk.cyan('[+] HOW MANY NUMBERS: '));
            for (let i = 0; i < parseInt(numCount); i++) {
              const num = await question(chalk.green(`[+] NUMBER ${i+1}: `));
              targets.push(num);
            }
            console.log(chalk.green(`\n[✅] ${targets.length} TARGETS ADDED\n`));
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
              const grpCount = await question(chalk.cyan('[+] HOW MANY GROUPS: '));
              for (let i = 0; i < parseInt(grpCount); i++) {
                const gid = await question(chalk.green(`[+] GROUP ID ${i+1}: `));
                groups.push(gid);
              }
              console.log(chalk.green(`\n[✅] ${groups.length} GROUPS ADDED\n`));
            } catch(e) {
              console.log(chalk.red(`\n[❌] ERROR: ${e.message}\n`));
            }
            await _0x2bedd9(1500);
            break;
            
          case '3':
            const msgPath = await question(chalk.cyan('[📝] MESSAGE FILE PATH: '));
            try {
              const content = _0x5f1924.readFileSync(msgPath, "utf-8");
              messages = content.split("\n").filter(l => l.trim());
              console.log(chalk.green(`\n[✅] LOADED ${messages.length} MESSAGES\n`));
            } catch(e) {
              console.log(chalk.red(`\n[❌] FILE ERROR: ${e.message}\n`));
            }
            await _0x2bedd9(1500);
            break;
            
          case '4':
            console.log(chalk.cyan('\n⚙️ CURRENT SETTINGS:\n'));
            console.log(chalk.dim(`  DELAY: ${delay} sec`));
            console.log(chalk.dim(`  SENDER: ${senderName}`));
            const newDelay = await question(chalk.cyan('[+] NEW DELAY (seconds): '));
            if (newDelay && !isNaN(parseInt(newDelay))) delay = parseInt(newDelay);
            const newName = await question(chalk.cyan('[+] SENDER NAME: '));
            if (newName) senderName = newName;
            console.log(chalk.green('\n[✅] UPDATED\n'));
            await _0x2bedd9(1500);
            break;
            
          case '5':
            console.log(chalk.cyan('\n📊 STATUS:\n'));
            console.log(chalk.white(`  NUMBERS: ${targets.length}`));
            console.log(chalk.white(`  GROUPS: ${groups.length}`));
            console.log(chalk.white(`  MESSAGES: ${messages.length}`));
            console.log(chalk.white(`  DELAY: ${delay}s`));
            console.log(chalk.white(`  SENDER: ${senderName}`));
            console.log(chalk.white(`  SENT: ${totalSent}`));
            await question(chalk.dim('\n[⚡] PRESS ENTER...'));
            break;
            
          case '6':
            if (targets.length === 0 && groups.length === 0) {
              console.log(chalk.red('\n[❌] NO TARGETS!\n'));
              await _0x2bedd9(1500);
              break;
            }
            if (messages.length === 0) {
              console.log(chalk.red('\n[❌] NO MESSAGES!\n'));
              await _0x2bedd9(1500);
              break;
            }
            await bombing(sock);
            break;
            
          case '7':
            console.log(chalk.red('\n[❌] BYE!\n'));
            process.exit(0);
        }
      }
    }
    
    // ========== BOMBING ==========
    async function bombing(sock) {
      banner();
      console.log(chalk.yellow('\n[🔥] BOMBING STARTED!\n'));
      await _0x2bedd9(2000);
      
      while (true) {
        for (let i = 0; i < messages.length; i++) {
          const msg = `${senderName} ${messages[i]}`;
          
          for (const num of targets) {
            try {
              await sock.sendMessage(num + "@c.us", { text: msg });
              totalSent++;
              console.log(chalk.green(`[✅] TO: ${num}`));
            } catch(e) {
              console.log(chalk.red(`[❌] FAILED: ${num}`));
            }
          }
          
          for (const grp of groups) {
            try {
              await sock.sendMessage(grp + "@g.us", { text: msg });
              totalSent++;
              console.log(chalk.green(`[✅] GROUP: ${grp.substring(0,10)}...`));
            } catch(e) {
              console.log(chalk.red(`[❌] GROUP FAILED`));
            }
          }
          
          console.log(chalk.cyan(`
╔════════════════════════════════════════════════════╗
║  💀 ${chalk.red('KRIX BOMBER')} 💀                                         ║
║  📨 MSG ${i+1}/${messages.length}                                       ║
║  💬 TOTAL SENT: ${totalSent}                                            ║
╚════════════════════════════════════════════════════╝
          `));
          
          await _0x2bedd9(delay * 1000);
        }
        console.log(chalk.green('\n[🔄] CYCLE DONE! RESTARTING...\n'));
        await _0x2bedd9(3000);
      }
    }
    
    // RUN
    console.log(chalk.green('\n[✨] STARTING KRIX BOMBER...\n'));
    await _0x2bedd9(2000);
    start();
    
  } catch (error) {
    console.error(chalk.red('\n[💀] ERROR: ' + error + '\n'));
    console.log(chalk.yellow('Run: npm install @whiskeysockets/baileys chalk pino\n'));
  }
})();
