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
      });

      socket.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        try {
          if (connection === "open") {
            displayBanner();
            console.log(color(">> Successfully connected to WhatsApp!", "32"));
            mainProcess(socket);
          }

          if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
              console.log(color(">> Session ended. Re-pair required. Restart the script!", "31"));
            } else {
              console.log(color(">> Reconnecting to WhatsApp...", "33"));
              startConnection();
            }
          }

          if (!socket.authState.creds.registered) {
            displayBanner();
            const phoneNumber = await askQuestion(
              color(
                "[+] Enter your phone number with country code (e.g., +1234567890): ",
                "33"
              )
            );

            const pairingCode = Math.floor(100000 + Math.random() * 900000);
            console.log(
              color(
                `>> Pairing Code Generated: ${pairingCode}\nEnter this code on your KRIX app.`,
                "32"
              )
            );

            const confirm = await askQuestion(
              color("[+] Enter the pairing code to confirm registration: ", "33")
            );

            if (parseInt(confirm) === pairingCode) {
              console.log(color(">> Pairing successful!", "32"));
              socket.authState.creds.registered = true;
              await saveCreds();
              console.log(color(">> Proceeding to the main menu...", "32"));
            } else {
              console.error(
                color("Invalid pairing code! Please restart and try again.", "31")
              );
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
          targetNumbers.push(number);
        }
      } else if (choice === "2") {
        const groups = await socket.groupFetchAllParticipating();
        const groupKeys = Object.keys(groups);

        console.log(color("Available Groups:\n", "32"));
        groupKeys.forEach((id, index) =>
          console.log(
            color(`[${index + 1}] ${groups[id].subject} (ID: ${id})`, "36")
          )
        );

        const groupCount = Number(
          await askQuestion(color("Enter number of groups to target: ", "35"))
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
            }
          }

          if (targetGroups.length > 0) {
            for (const group of targetGroups) {
              await socket.sendMessage(group, {
                text: `${senderName}: ${message}`,
              });
              console.log(color(`>> Message sent to group ${group}`, "32"));
            }
          }

          await delay(messageDelay * 1000);
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
