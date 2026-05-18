(async () => {
  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      delay,
      DisconnectReason,
      Browsers
    } = await import("@whiskeysockets/baileys");
    
    const fs = await import('fs');
    const path = await import('path');
    const pino = (await import("pino")).default;
    const readline = await import("readline");
    const chalk = (await import('chalk')).default;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    const question = (text) => new Promise(resolve => rl.question(text, resolve));

    // ==================== BANNER ====================
    const banner = () => {
      console.clear();
      console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    ██╗  ██╗██████╗ ██╗██╗  ██╗    ██████╗  ██████╗ ███╗   ██╗║
║    ██║ ██╔╝██╔══██╗██║╚██╗██╔╝    ██╔══██╗██╔═══██╗████╗  ██║║
║    █████╔╝ ██████╔╝██║ ╚███╔╝     ██████╔╝██║   ██║██╔██╗ ██║║
║    ██╔═██╗ ██╔══██╗██║ ██╔██╗     ██╔══██╗██║   ██║██║╚██╗██║║
║    ██║  ██╗██║  ██║██║██╔╝ ██╗    ██████╔╝╚██████╔╝██║ ╚████║║
║    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝    ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  👤 OWNER       : ${chalk.magenta('KRIX GOD')}                                      ║
║  🔥 TOOL        : ${chalk.green('WHATSAPP BOMBER')}                                ║
║  💀 VERSION     : ${chalk.yellow('7.0 FULL')}                                       ║
║  ⚡ STATUS      : ${chalk.cyan('ONLINE')}                                           ║
║  📱 AUTH METHOD : ${chalk.blue('PAIRING CODE')}                                    ║
╚═══════════════════════════════════════════════════════════════╝
      `));
    };

    // ==================== GLOBAL STATE ====================
    let sock = null;
    let targets = [];
    let messages = [];
    let messageDelay = 2;
    let totalSent = 0;
    let isRunning = false;

    // ==================== INITIALIZATION ====================
    const initBot = async () => {
      try {
        const authPath = "./auth_info";
        if (!fs.existsSync(authPath)) {
          fs.mkdirSync(authPath, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        sock = makeWASocket({
          logger: pino({ level: "silent" }),
          auth: state,
          browser: Browsers.chrome("120.0.0.0"),
          syncFullHistory: false,
          generateHighQualityLinkPreview: false,
          printQRInTerminal: false
        });

        // ==================== EVENT: CONNECTION UPDATE ====================
        sock.ev.on("connection.update", async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            console.log(chalk.red("[!] QR Method Detected - Use Pairing Code instead"));
          }

          if (connection === "open") {
            banner();
            console.log(chalk.green("\n✅ [CONNECTED] WhatsApp Session Active!\n"));
            totalSent = 0;
            await mainMenu();
          }

          if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
              console.log(chalk.red("\n❌ [LOGGED OUT] Deleting auth_info folder..."));
              fs.rmSync("./auth_info", { recursive: true, force: true });
              rl.close();
              process.exit(0);
            } else {
              console.log(chalk.yellow("\n🔄 [RECONNECTING] in 5 seconds..."));
              await delay(5000);
              await initBot();
            }
          }
        });

        // ==================== EVENT: CREDENTIALS UPDATE ====================
        sock.ev.on("creds.update", saveCreds);

        // ==================== PAIRING CODE REQUEST ====================
        if (!state.creds.registered) {
          banner();
          console.log(chalk.yellow("\n🔐 [PAIRING] No Session Found\n"));

          const phoneNumber = await question(
            chalk.green("[+] Enter Phone Number (with country code, e.g., 919876543210): ")
          );

          const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");

          if (cleanNumber.length < 10) {
            console.log(chalk.red("[!] Invalid phone number"));
            rl.close();
            process.exit(1);
          }

          console.log(chalk.yellow(`\n[📱] Requesting pairing code for: ${cleanNumber}\n`));

          try {
            const pairingCode = await sock.requestPairingCode(cleanNumber);

            banner();
            console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║             🔐 YOUR WHATSAPP PAIRING CODE 🔐                  ║
║                                                               ║
║                 ${chalk.bgWhite.black(` ${pairingCode} `)}                       ║
║                                                               ║
║  📖 INSTRUCTIONS:                                             ║
║  1. Open WhatsApp on your phone                               ║
║  2. Go to Settings → Linked Devices                           ║
║  3. Click "Link with Phone Number"                            ║
║  4. Enter the code above                                      ║
║                                                               ║
║  ⏱️  Code expires in 5 minutes                                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
            `));

            console.log(chalk.dim("\n[⚡] Waiting for phone confirmation...\n"));
          } catch (err) {
            console.log(chalk.red(`[!] Error requesting pairing code: ${err.message}`));
            rl.close();
            process.exit(1);
          }
        } else {
          banner();
          console.log(chalk.green("\n✅ [SESSION FOUND] Loading existing session...\n"));
        }
      } catch (err) {
        console.error(chalk.red(`[ERROR] Initialization failed: ${err.message}`));
        process.exit(1);
      }
    };

    // ==================== MAIN MENU ====================
    const mainMenu = async () => {
      while (true) {
        banner();
        console.log(chalk.white(`
 ${chalk.cyan("[1]")} ${chalk.green("SET TARGET NUMBERS")}
     ${chalk.dim("(Comma separated: 9198xxxxxx,9197xxxxxx)")}

 ${chalk.cyan("[2]")} ${chalk.green("SET MESSAGE")}
     ${chalk.dim("(Direct text or load from .txt file)")}

 ${chalk.cyan("[3]")} ${chalk.green("SET MESSAGE DELAY")}
     ${chalk.dim(`(Current: ${messageDelay}s)`)}

 ${chalk.cyan("[4]")} ${chalk.magenta("VIEW CONFIGURATION")}
     ${chalk.dim(`(Targets: ${targets.length} | Messages: ${messages.length})`)}

 ${chalk.cyan("[5]")} ${chalk.yellow("START SENDING")}
     ${chalk.dim(`(Total Sent: ${totalSent})`)}

 ${chalk.cyan("[0]")} ${chalk.red("EXIT")}
        `));

        const choice = await question(chalk.yellow("\n[>] Enter your choice: "));

        switch (choice) {
          case "1":
            await setTargets();
            break;
          case "2":
            await setMessage();
            break;
          case "3":
            await setDelay();
            break;
          case "4":
            await viewConfig();
            break;
          case "5":
            await startSending();
            break;
          case "0":
            console.log(chalk.yellow("\n[!] Exiting..."));
            rl.close();
            process.exit(0);
          default:
            console.log(chalk.red("[!] Invalid option"));
            await delay(1000);
        }
      }
    };

    // ==================== SET TARGETS ====================
    const setTargets = async () => {
      console.clear();
      console.log(chalk.cyan("\n📞 [SET TARGETS]\n"));

      const input = await question(
        chalk.green("[+] Enter phone numbers (comma separated, with country code):\n> ")
      );

      if (input.trim() === "") {
        console.log(chalk.red("[!] No numbers entered"));
        await delay(1500);
        return;
      }

      targets = input
        .split(",")
        .map((num) => {
          const clean = num.trim().replace(/[^0-9]/g, "");
          return clean.length >= 10 ? `${clean}@s.whatsapp.net` : null;
        })
        .filter((x) => x !== null);

      console.log(chalk.green(`\n✅ [SUCCESS] ${targets.length} target(s) added\n`));
      await delay(1500);
    };

    // ==================== SET MESSAGE ====================
    const setMessage = async () => {
      console.clear();
      console.log(chalk.cyan("\n💬 [SET MESSAGE]\n"));

      const input = await question(
        chalk.green("[+] Enter message or path to .txt file:\n> ")
      );

      if (input.trim() === "") {
        console.log(chalk.red("[!] No message entered"));
        await delay(1500);
        return;
      }

      try {
        if (fs.existsSync(input)) {
          const content = fs.readFileSync(input, "utf-8");
          messages = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          console.log(chalk.green(`\n✅ [SUCCESS] Loaded ${messages.length} message(s) from file\n`));
        } else {
          messages = [input];
          console.log(chalk.green(`\n✅ [SUCCESS] 1 message set\n`));
        }
      } catch (err) {
        console.log(chalk.red(`[!] Error: ${err.message}`));
      }

      await delay(1500);
    };

    // ==================== SET DELAY ====================
    const setDelay = async () => {
      console.clear();
      console.log(chalk.cyan("\n⏱️  [SET DELAY]\n"));

      const input = await question(chalk.green("[+] Enter delay in seconds (minimum 1): "));
      const parsed = parseInt(input);

      if (isNaN(parsed) || parsed < 1) {
        console.log(chalk.red("[!] Invalid delay. Set to default 2s"));
        messageDelay = 2;
      } else {
        messageDelay = parsed;
        console.log(chalk.green(`\n✅ [SUCCESS] Delay set to ${messageDelay}s\n`));
      }

      await delay(1500);
    };

    // ==================== VIEW CONFIG ====================
    const viewConfig = async () => {
      console.clear();
      console.log(chalk.cyan("\n⚙️  [CONFIGURATION]\n"));

      console.log(chalk.yellow(`📱 Targets: ${targets.length}`));
      if (targets.length > 0) {
        targets.slice(0, 5).forEach((t) => console.log(chalk.gray(`   • ${t}`)));
        if (targets.length > 5) console.log(chalk.gray(`   ... and ${targets.length - 5} more`));
      }

      console.log(chalk.yellow(`\n💬 Messages: ${messages.length}`));
      if (messages.length > 0) {
        messages.slice(0, 3).forEach((m) => console.log(chalk.gray(`   • ${m.substring(0, 50)}...`)));
        if (messages.length > 3) console.log(chalk.gray(`   ... and ${messages.length - 3} more`));
      }

      console.log(chalk.yellow(`\n⏱️  Delay: ${messageDelay}s`));
      console.log(chalk.yellow(`📊 Total Sent: ${totalSent}`));

      await question(chalk.dim("\n[Press Enter to continue]"));
    };

    // ==================== START SENDING ====================
    const startSending = async () => {
      if (targets.length === 0 || messages.length === 0) {
        console.log(chalk.red("\n[!] Error: Please set targets and messages first\n"));
        await delay(2000);
        return;
      }

      console.clear();
      console.log(chalk.magenta(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                  🚀 BOMBING INITIALIZED 🚀                    ║
║                                                               ║
║  Targets: ${targets.length}                                                     ║
║  Messages: ${messages.length}                                                    ║
║  Delay: ${messageDelay}s                                                      ║
║                                                               ║
║  Press CTRL+C to stop at any time                             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `));

      isRunning = true;
      let messageIndex = 0;

      process.on("SIGINT", async () => {
        console.log(chalk.yellow(`\n\n[!] Stopped. Total messages sent: ${totalSent}`));
        isRunning = false;
        await delay(1000);
        return;
      });

      while (isRunning) {
        for (const target of targets) {
          if (!isRunning) break;

          try {
            const currentMessage = messages[messageIndex % messages.length];

            await sock.sendMessage(target, {
              text: currentMessage
            });

            totalSent++;
            console.log(
              chalk.green(
                `[✅] [${totalSent}] Message sent to ${target.replace("@s.whatsapp.net", "")} | Time: ${new Date().toLocaleTimeString()}`
              )
            );

            await delay(messageDelay * 1000);
          } catch (err) {
            console.log(
              chalk.red(
                `[❌] Failed to send to ${target.replace("@s.whatsapp.net", "")}: ${err.message}`
              )
            );
            await delay(3000);
          }
        }

        messageIndex++;
        console.log(chalk.cyan(`\n[📍] Completed round ${messageIndex}. Continuing...\n`));
      }
    };

    // ==================== START APPLICATION ====================
    await initBot();

  } catch (err) {
    console.error(chalk.red(`[CRITICAL ERROR] ${err.message}`));
    process.exit(1);
  }
})();
