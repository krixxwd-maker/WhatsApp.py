import { makeWASocket, useMultiFileAuthState, delay, DisconnectReason, Browsers } from "@whiskeysockets/baileys";
import fs from 'fs';
import pino from "pino";
import readline from "readline";
import os from 'os';
import crypto from "crypto";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));
const color = (text, colorCode) => `\x1b[${colorCode}m${text}\x1b[0m`;

const showBanner = () => {
  console.clear();
  console.log(color("┌────────────────────────────────────────┐", "36"));
  console.log(color("│  ██╗  ██╗██████╗ ██╗██╗  ██╗           │", "31"));
  console.log(color("│  ██║ ██╔╝██╔══██╗██║╚██╗██╔╝           │", "31"));
  console.log(color("│  █████╔╝ ██████╔╝██║ ╚███╔╝            │", "31"));
  console.log(color("│  ██╔═██╗ ██╔══██╗██║ ██╔██╗            │", "31"));
  console.log(color("│  ██║  ██╗██║  ██║██║██╔╝ ██╗           │", "31"));
  console.log(color("│  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝           │", "31"));
  console.log(color("├────────────────────────────────────────┤", "36"));
  console.log(color("│    ⚡ WHATSAPP PROPER COUPLER ⚡       │", "33"));
  console.log(color("└────────────────────────────────────────┘", "36"));
};

let targetNumbers = [];
let targetGroups = [];
let messageLines = [];
let delayTime = 2;
let haterName = "";
let currentMessageIndex = 0;

async function startSendingMessages(socket) {
  while (true) {
    for (let i = currentMessageIndex; i < messageLines.length; i++) {
      try {
        const timestamp = new Date().toLocaleTimeString();
        const fullMessage = `${haterName} ${messageLines[i]}`;

        if (targetNumbers.length > 0) {
          for (const num of targetNumbers) {
            let formattedNum = num.includes('@') ? num : `${num}@s.whatsapp.net`;
            await socket.sendMessage(formattedNum, { text: fullMessage });
            console.log(color(`[TARGET NUMBER => ${num}]`, "32"));
          }
        } else {
          for (const groupUid of targetGroups) {
            let formattedGroup = groupUid.includes('@') ? groupUid : `${groupUid}@g.us`;
            await socket.sendMessage(formattedGroup, { text: fullMessage });
            console.log(color(`[GROUP UID => ${groupUid}]`, "33"));
          }
        }

        console.log(color(`[TIME => ${timestamp}]`, "34"));
        console.log(color(`[MESSAGE => ${fullMessage}]`, "35"));
        console.log(color("[<<====================================>>]", "37"));
        
        await delay(delayTime * 1000);
      } catch (error) {
        console.log(color("[!] Transmission suspended, retrying...", "31"));
        currentMessageIndex = i;
        await delay(5000);
      }
    }
    currentMessageIndex = 0;
  }
}

const startWhatsApp = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  // CRITICAL FIX: व्हाट्सएप पेयरिंग कोड रिजेक्शन को रोकने के लिए आधिकारिक Browsers फ़ॉर्मेट
  const socket = makeWASocket({
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: false,
    mobile: false,
    browser: Browsers.macOS("Chrome"), // बिल्कुल ओरिजिनल व्हाट्सएप वेब की तरह सिंक करेगा
    shouldSyncHistoryMessage: () => false // फालतू की हिस्ट्री लोड नहीं करेगा जिससे क्रैश बचे
  });

  if (!socket.authState.creds.registered) {
    showBanner();
    let phoneNumber = await askQuestion(color("[+] ENTER PHONE NUMBER (with country code, e.g. 916005020676) => ", "36"));
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    if (!phoneNumber) {
      console.log(color("[!] Invalid Phone input. Restarting.", "31"));
      process.exit(1);
    }

    try {
      // सॉकेट को पूरी तरह ओपन/कनेक्टिंग मोड में आने का समय दें
      await delay(3000);
      const code = await socket.requestPairingCode(phoneNumber);
      showBanner();
      console.log(color(`[√] YOUR OFFICIAL PARING CODE => ${code}`, "32"));
      console.log(color("[!] WhatsApp > Linked Devices > Link with Phone Number पर जाएँ।", "33"));
    } catch (err) {
      console.error(color("[!] Server busy or pairing code rejected. Delete auth_info folder and retry.", "31"));
      process.exit(1);
    }
  }

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      showBanner();
      console.log(color("[✓] LINKING VERIFIED – WHATSAPP CONNECTED SUCCESSFULLY!", "32"));

      const choice = await askQuestion(color("[1] DISPATCH TO TARGET NUMBER\n[2] DISPATCH TO GROUP\nCHOOSE OPTION => ", "36"));

      if (choice === '1') {
        const count = await askQuestion(color("[+] NUMBER OF TARGETS? => ", "32"));
        for (let i = 0; i < parseInt(count); i++) {
          let num = await askQuestion(color(`[+] ENTER TARGET NUMBER ${i + 1} => `, "34"));
          targetNumbers.push(num.replace(/[^0-9]/g, ''));
        }
      } else if (choice === '2') {
        try {
          console.log(color("[...] Fetching current directories...", "33"));
          const groups = await socket.groupFetchAllParticipating();
          const groupUids = Object.keys(groups);
          
          showBanner();
          console.log(color("[√] AVAILABLE GROUP CONFIGURATIONS =>", "33"));
          groupUids.forEach((uid, index) => {
            console.log(color(`[${index + 1}] NAME: ${groups[uid].subject} [UID: ${uid}]`, "34"));
          });

          const count = await askQuestion(color("[+] QUANTITY OF GROUPS => ", "35"));
          for (let i = 0; i < parseInt(count); i++) {
            const uid = await askQuestion(color(`[+] ENTER GROUP UID ${i + 1} => `, "36"));
            targetGroups.push(uid.trim());
          }
        } catch (e) {
          console.log(color("[!] Directory read failure. Specify UID manually.", "31"));
          const uid = await askQuestion(color("[+] ENTER GROUP UID => ", "36"));
          targetGroups.push(uid.trim());
        }
      }

      const filePath = await askQuestion(color("[+] ENTER SOURCE FILE PATH => ", "37"));
      if (fs.existsSync(filePath)) {
        messageLines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
      } else {
        console.log(color("[!] Target filepath invalid. Initializing fallback structure.", "31"));
        messageLines = ["Proper Fix Connected!"];
      }

      haterName = await askQuestion(color("[+] ENTER LOG SIGNATURE / NAME => ", "32"));
      const delayInput = await askQuestion(color("[+] ENTER INTERVAL DELAY (seconds) => ", "34"));
      delayTime = parseFloat(delayInput) || 2;

      console.log(color("[√] Parameters validated.", "32"));
      showBanner();
      console.log(color("[ENGAGING TRANSMISSION PROCESS.......]", "36"));
      
      startSendingMessages(socket);
    }

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        console.log(color("[!] Connection temporary closed. Auto-reloading...", "33"));
        setTimeout(() => startWhatsApp(), 5000);
      } else {
        console.log(color("[!] Session Logged Out. Clear 'auth_info' and scan again.", "31"));
        process.exit(1);
      }
    }
  });

  socket.ev.on("creds.update", saveCreds);
};

const systemKey = crypto.createHash("sha256").update(os.platform() + os.userInfo().username).digest("hex");
console.log(color("MACHINE KEY ID: " + systemKey, "36"));

startWhatsApp().catch(err => console.error("Initialization Failed: ", err));
