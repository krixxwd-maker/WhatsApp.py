import { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } from "@whiskeysockets/baileys";
import fs from 'fs';
import pino from "pino";
import readline from "readline";
import axios from "axios";
import os from 'os';
import crypto from "crypto";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));
const color = (text, colorCode) => `\x1b[${colorCode}m${text}\x1b[0m`;

// ===================== MOTO & COMPACT BANNER =====================
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
  console.log(color("│       ⚡ WHATSAPP BOMBER BY KRIX ⚡    │", "33"));
  console.log(color("└────────────────────────────────────────┘", "36"));
};
// ==============================================================

let targetNumbers = [];
let targetGroups = [];
let messageLines = [];
let delayTime = 2;
let haterName = "";
let currentMessageIndex = 0;

// Auto see status/presence feature from your original script
const autoSeeStatuses = async (socket) => {
  socket.ev.on("presence.update", async (presence) => {
    if (presence.status === "available") {
      const chat = presence.id.split("@")[0];
      await socket.sendMessage(chat + "@s.whatsapp.net", { text: "Seen" });
    }
  });
};

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
        console.log(color("[<<===========•KRIX X BOMBER•===========>>]", "37"));
        
        await delay(delayTime * 1000);
      } catch (error) {
        console.log(color("[!] Message failed to send, retrying...", "31"));
        currentMessageIndex = i;
        await delay(5000);
      }
    }
    currentMessageIndex = 0;
  }
}

const startWhatsApp = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  const socket = makeWASocket({
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: false,
    mobile: false,
    browser: ['Chrome (Linux)', 'Chrome', '10.0.0'] 
  });

  if (!socket.authState.creds.registered) {
    showBanner();
    let phoneNumber = await askQuestion(color("[+] ENTER PHONE NUMBER (with country code, e.g. 916005020676) => ", "36"));
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    if (!phoneNumber) {
      console.log(color("[!] Invalid Phone Number. Restart the script.", "31"));
      process.exit(1);
    }

    try {
      await delay(2000);
      const code = await socket.requestPairingCode(phoneNumber);
      showBanner();
      console.log(color(`[√] YOUR PAIRING CODE => ${code}`, "31"));
      console.log(color("[!] Open WhatsApp > Linked Devices > Link a Device > Enter code manually.", "33"));
      console.log(color("[!] After entering the code, the script will automatically connect.", "33"));
    } catch (err) {
      console.error(color("[!] Error generating pairing code. Try again.", "31"), err);
      process.exit(1);
    }
  }

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      showBanner();
      console.log(color("[✓] LOGIN SUCCESSFUL – NOW YOU CAN USE THE TOOL", "32"));

      const choice = await askQuestion(color("[1] SEND TO TARGET NUMBER\n[2] SEND TO WHATSAPP GROUP\nCHOOSE OPTION => ", "36"));

      if (choice === '1') {
        const count = await askQuestion(color("[+] HOW MANY TARGET NUMBERS? => ", "32"));
        for (let i = 0; i < parseInt(count); i++) {
          let num = await askQuestion(color(`[+] ENTER TARGET NUMBER ${i + 1} => `, "34"));
          targetNumbers.push(num.replace(/[^0-9]/g, ''));
        }
      } else if (choice === '2') {
        try {
          console.log(color("[...] Fetching Groups...", "33"));
          const groups = await socket.groupFetchAllParticipating();
          const groupUids = Object.keys(groups);
          
          showBanner();
          console.log(color("[√] WHATSAPP GROUPS =>", "33"));
          groupUids.forEach((uid, index) => {
            console.log(color(`[${index + 1}] GROUP NAME: ${groups[uid].subject} [UID: ${uid}]`, "34"));
          });

          const count = await askQuestion(color("[+] HOW MANY GROUPS TO TARGET => ", "35"));
          for (let i = 0; i < parseInt(count); i++) {
            const uid = await askQuestion(color(`[+] ENTER GROUP UID ${i + 1} => `, "36"));
            targetGroups.push(uid.trim());
          }
        } catch (e) {
          console.log(color("[!] Failed to fetch groups automatically. Enter UID manually.", "31"));
          const uid = await askQuestion(color("[+] ENTER GROUP UID => ", "36"));
          targetGroups.push(uid.trim());
        }
      }

      const filePath = await askQuestion(color("[+] ENTER MESSAGE FILE PATH => ", "37"));
      if (fs.existsSync(filePath)) {
        messageLines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
      } else {
        console.log(color("[!] File not found! Defaulting to test messages.", "31"));
        messageLines = ["Boom!", "Krix was here"];
      }

      haterName = await askQuestion(color("[+] ENTER HATER NAME => ", "32"));
      const delayInput = await askQuestion(color("[+] ENTER MESSAGE DELAY (in seconds) => ", "34"));
      delayTime = parseFloat(delayInput) || 2;

      console.log(color("[√] All Details Filled Correctly", "32"));
      showBanner();
      console.log(color("[NOW STARTING MESSAGE SENDING.......]", "36"));
      
      startSendingMessages(socket);
      autoSeeStatuses(socket);
    }

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(color(`[!] Connection closed. Reconnecting: ${shouldReconnect}`, "33"));
      
      if (shouldReconnect) {
        setTimeout(() => startWhatsApp(), 5000);
      } else {
        console.log(color("[!] Logged out from WhatsApp. Delete './auth_info' and restart.", "31"));
        process.exit(1);
      }
    }
  });

  socket.ev.on("creds.update", saveCreds);
};

// ===================== ORIGINAL KEY SYSTEM LAYER =====================
const systemKey = crypto.createHash("sha256").update(os.platform() + os.userInfo().username).digest("hex");
console.log(color("YOUR KEY: " + systemKey, "36"));
console.log(color("[Waiting for login...]", "37"));

// Run the script
startWhatsApp().catch(err => console.error("Critical Error: ", err));

process.on('exit', () => {});
