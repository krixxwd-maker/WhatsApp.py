#!/usr/bin/env node

(async () => {
  try {
    const {
      makeWASocket,
      useMultiFileAuthState,
      delay,
      DisconnectReason,
    } = await import("@whiskeysockets/baileys");
    const fs = await import("fs");
    const pino = (await import("pino")).default;
    const readline = (await import("readline")).createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const crypto = await import("crypto");
    const os = await import("os");

    const askQuestion = (message) =>
      new Promise((resolve) => readline.question(message, resolve));

    const color = (text, code) => `\x1b[${code}m${text}\x1b[0m`;

    const displayBanner = () => {
      console.clear();
      console.log(color("╔═════════════════════════════════════════════════════════════════════════╗", "36"));
      console.log(color("║                                                                         ║", "36"));
      console.log(color("║   ██╗  ██╗███████╗██╗██╗  ██╗        ██╗  ██╗██████╗ ██╗  ██╗           ║", "35"));
      console.log(color("║   ██║ ██╔╝██╔════╝██║██║ ██╔╝        ██║  ██║██╔══██╗╚██╗██╔╝           ║", "34"));
      console.log(color("║   █████╔╝ █████╗  ██║█████╔╝         ███████║██████╔╝ ╚███╔╝            ║", "36"));
      console.log(color("║   ██╔═██╗ ██╔══╝  ██║██╔═██╗         ██╔══██║██╔═══╝  ██╔██╗            ║", "33"));
      console.log(color("║   ██║  ██╗███████╗██║██║  ██╗        ██║  ██║██║     ██╔╝ ██╗           ║", "35"));
      console.log(color("║   ╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═╝        ╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝           ║", "36"));
      console.log(color("║                                                                         ║", "36"));
      console.log(color("║        ★ KRIX - Powering Connections One Message at a Time ★           ║", "33"));
      console.log(color("╚═════════════════════════════════════════════════════════════════════════╝", "36"));
    };

    let targetNumbers = [];
    let targetGroups = [];
    let messageList = null;
    let senderName = null;
    let messageDelay = null;

    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

    const startConnection = async () => {
      const socket = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false, // Explicitly false since we are using pairing codes
      });

      // FIX: Handle pairing verification if credentials don't exist yet
      if (!socket.authState.creds.registered) {
        displayBanner();
        let phoneNumber = await askQuestion(
          color("[+] Enter your phone number with country code (e.g., +1234567890): ", "33")
        );
        
        // Clean up formatting input from user (remove spaces, plus symbols, dashes)
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

        if (!phoneNumber) {
          console.error(color("Invalid phone number format. Restart the script.", "31"));
          process.exit(1);
        }

        try {
          // Request the ACTUAL pairing code from WhatsApp servers via Baileys
          const code = await socket.requestPairingCode(phoneNumber);
          
          console.log(color("\n==================================================", "36"));
          console.log(color(`>> YOUR WHATSAPP PAIRING CODE: ${code}`, "32"));
          console.log(color("==================================================\n", "36"));
          console.log(color("Open WhatsApp -> Linked Devices -> Link with Phone Number instead and enter the code above.\n", "33"));
        } catch (err) {
          console.error(color("Failed to request pairing code: " + err.message, "31"));
          process.exit(1);
        }
      }

      socket.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        try {
          if (connection === "open") {
            displayBanner();
            console.log(color(">> Successfully connected to WhatsApp!", "32"));
            mainProcess(socket);
          }

          if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
              console.log(color(">> Reconnecting to WhatsApp...", "33"));
              startConnection();
            } else {
              console.log(color(">> Session ended. Logged out by user. Delete './auth_info' and restart!", "31"));
              process.exit(1);
            }
          }
        } catch (err) {
          console.error(color(">> Error during connection update: " + err.message, "31"));
        }
      });

      socket.ev.on("creds.update", saveCreds);
    };

    const mainProcess = async (socket) => {
      const choice = await askQuestion(
        color("[1] Target Numbers\n[2] Target Groups\nChoose Option: ", "33")
      );

      if (choice === "1") {
        const count = Number(
          await askQuestion(color("Enter number of target numbers: ", "36"))
        );
        for (let i = 0; i < count; i++) {
          const number = await askQuestion(
            color(`Enter target number ${i + 1} (e.g. 1234567890): `, "35")
          );
          // Clean non-digits out of standard telephone strings
          targetNumbers.push(number.replace(/[^0-9]/g, ""));
        }
      } else if (choice === "2") {
        console.log(color("Fetching your WhatsApp groups...", "33"));
        const groups = await socket.groupFetchAllParticipating();
        const groupKeys = Object.keys(groups);

        if (groupKeys.length === 0) {
          console.log(color("No active groups found on this account.", "31"));
          process.exit(0);
        }

        console.log(color("\nAvailable Groups:\n", "32"));
        groupKeys.forEach((id, index) =>
          console.log(
            color(`[${index + 1}] ${groups[id].subject} (ID: ${id})`, "36")
          )
        );

        const groupCount = Number(
          await askQuestion(color("\nEnter number of groups to target: ", "35"))
        );
        for (let i = 0; i < groupCount; i++) {
          const groupId = await askQuestion(
            color(`Enter group ID for target ${i + 1}: `, "34")
          );
          targetGroups.push(groupId);
        }
      }

      const filePath = await askQuestion(
        color("Enter path to the message file (e.g., messages.txt): ", "33")
      );
      if (fs.existsSync(filePath)) {
        messageList = fs
          .readFileSync(filePath, "utf-8")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean);
      } else {
        console.error(color("[Error] File not found. Please check the path.", "31"));
        process.exit(1);
      }

      senderName = await askQuestion(
        color("Enter your name (for message signature): ", "35")
      );
      messageDelay = Number(
        await askQuestion(color("Enter delay between messages (in seconds): ", "36"))
      );

      console.log(color(">> Initiating message broadcasting...", "32"));
      await broadcastMessages(socket);
    };

    const broadcastMessages = async (socket) => {
      for (const message of messageList) {
        try {
          if (targetNumbers.length > 0) {
            for (const number of targetNumbers) {
              await socket.sendMessage(`${number}@s.whatsapp.net`, {
                text: `${senderName}: ${message}`,
              });
              console.log(color(`>> Message sent to ${number}`, "32"));
              await delay(messageDelay * 1000); // Delay inside loop blocks to prevent rate limit bans
            }
          }

          if (targetGroups.length > 0) {
            for (const group of targetGroups) {
              await socket.sendMessage(group, {
                text: `${senderName}: ${message}`,
              });
              console.log(color(`>> Message sent to group ${group}`, "32"));
              await delay(messageDelay * 1000); 
            }
          }
        } catch (error) {
          console.error(color("Error during message broadcast: " + error, "31"));
        }
      }

      console.log(color(">> All messages sent successfully!", "32"));
      process.exit(0);
    };

    displayBanner();

    const uniqueKey = crypto
      .createHash("sha256")
      .update(os.platform() + os.userInfo().username)
      .digest("hex");
    console.log(color("Your Unique Key: " + uniqueKey, "35"));

    console.log(color(">> Starting connection process...", "32"));
    startConnection();

    process.on("exit", () => readline.close());
  } catch (error) {
    console.error(color("[Fatal Error] " + error.message, "31"));
    process.exit(1);
  }
})();
