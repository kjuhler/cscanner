"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// stubs/server-only.cjs
var require_server_only = __commonJS({
  "stubs/server-only.cjs"(exports2, module2) {
    "use strict";
    module2.exports = {};
  }
});

// node_modules/.pnpm/through@2.3.8/node_modules/through/index.js
var require_through = __commonJS({
  "node_modules/.pnpm/through@2.3.8/node_modules/through/index.js"(exports2, module2) {
    var Stream = require("stream");
    exports2 = module2.exports = through;
    through.through = through;
    function through(write, end, opts) {
      write = write || function(data) {
        this.queue(data);
      };
      end = end || function() {
        this.queue(null);
      };
      var ended = false, destroyed = false, buffer = [], _ended = false;
      var stream = new Stream();
      stream.readable = stream.writable = true;
      stream.paused = false;
      stream.autoDestroy = !(opts && opts.autoDestroy === false);
      stream.write = function(data) {
        write.call(this, data);
        return !stream.paused;
      };
      function drain() {
        while (buffer.length && !stream.paused) {
          var data = buffer.shift();
          if (null === data)
            return stream.emit("end");
          else
            stream.emit("data", data);
        }
      }
      stream.queue = stream.push = function(data) {
        if (_ended) return stream;
        if (data === null) _ended = true;
        buffer.push(data);
        drain();
        return stream;
      };
      stream.on("end", function() {
        stream.readable = false;
        if (!stream.writable && stream.autoDestroy)
          process.nextTick(function() {
            stream.destroy();
          });
      });
      function _end() {
        stream.writable = false;
        end.call(stream);
        if (!stream.readable && stream.autoDestroy)
          stream.destroy();
      }
      stream.end = function(data) {
        if (ended) return;
        ended = true;
        if (arguments.length) stream.write(data);
        _end();
        return stream;
      };
      stream.destroy = function() {
        if (destroyed) return;
        destroyed = true;
        ended = true;
        buffer.length = 0;
        stream.writable = stream.readable = false;
        stream.emit("close");
        return stream;
      };
      stream.pause = function() {
        if (stream.paused) return;
        stream.paused = true;
        return stream;
      };
      stream.resume = function() {
        if (stream.paused) {
          stream.paused = false;
          stream.emit("resume");
        }
        drain();
        if (!stream.paused)
          stream.emit("drain");
        return stream;
      };
      return stream;
    }
  }
});

// node_modules/.pnpm/unbzip2-stream@1.4.3/node_modules/unbzip2-stream/lib/bzip2.js
var require_bzip2 = __commonJS({
  "node_modules/.pnpm/unbzip2-stream@1.4.3/node_modules/unbzip2-stream/lib/bzip2.js"(exports2, module2) {
    function Bzip2Error(message2) {
      this.name = "Bzip2Error";
      this.message = message2;
      this.stack = new Error().stack;
    }
    Bzip2Error.prototype = new Error();
    var message = {
      Error: function(message2) {
        throw new Bzip2Error(message2);
      }
    };
    var bzip2 = {};
    bzip2.Bzip2Error = Bzip2Error;
    bzip2.crcTable = [
      0,
      79764919,
      159529838,
      222504665,
      319059676,
      398814059,
      445009330,
      507990021,
      638119352,
      583659535,
      797628118,
      726387553,
      890018660,
      835552979,
      1015980042,
      944750013,
      1276238704,
      1221641927,
      1167319070,
      1095957929,
      1595256236,
      1540665371,
      1452775106,
      1381403509,
      1780037320,
      1859660671,
      1671105958,
      1733955601,
      2031960084,
      2111593891,
      1889500026,
      1952343757,
      2552477408,
      2632100695,
      2443283854,
      2506133561,
      2334638140,
      2414271883,
      2191915858,
      2254759653,
      3190512472,
      3135915759,
      3081330742,
      3009969537,
      2905550212,
      2850959411,
      2762807018,
      2691435357,
      3560074640,
      3505614887,
      3719321342,
      3648080713,
      3342211916,
      3287746299,
      3467911202,
      3396681109,
      4063920168,
      4143685023,
      4223187782,
      4286162673,
      3779000052,
      3858754371,
      3904687514,
      3967668269,
      881225847,
      809987520,
      1023691545,
      969234094,
      662832811,
      591600412,
      771767749,
      717299826,
      311336399,
      374308984,
      453813921,
      533576470,
      25881363,
      88864420,
      134795389,
      214552010,
      2023205639,
      2086057648,
      1897238633,
      1976864222,
      1804852699,
      1867694188,
      1645340341,
      1724971778,
      1587496639,
      1516133128,
      1461550545,
      1406951526,
      1302016099,
      1230646740,
      1142491917,
      1087903418,
      2896545431,
      2825181984,
      2770861561,
      2716262478,
      3215044683,
      3143675388,
      3055782693,
      3001194130,
      2326604591,
      2389456536,
      2200899649,
      2280525302,
      2578013683,
      2640855108,
      2418763421,
      2498394922,
      3769900519,
      3832873040,
      3912640137,
      3992402750,
      4088425275,
      4151408268,
      4197601365,
      4277358050,
      3334271071,
      3263032808,
      3476998961,
      3422541446,
      3585640067,
      3514407732,
      3694837229,
      3640369242,
      1762451694,
      1842216281,
      1619975040,
      1682949687,
      2047383090,
      2127137669,
      1938468188,
      2001449195,
      1325665622,
      1271206113,
      1183200824,
      1111960463,
      1543535498,
      1489069629,
      1434599652,
      1363369299,
      622672798,
      568075817,
      748617968,
      677256519,
      907627842,
      853037301,
      1067152940,
      995781531,
      51762726,
      131386257,
      177728840,
      240578815,
      269590778,
      349224269,
      429104020,
      491947555,
      4046411278,
      4126034873,
      4172115296,
      4234965207,
      3794477266,
      3874110821,
      3953728444,
      4016571915,
      3609705398,
      3555108353,
      3735388376,
      3664026991,
      3290680682,
      3236090077,
      3449943556,
      3378572211,
      3174993278,
      3120533705,
      3032266256,
      2961025959,
      2923101090,
      2868635157,
      2813903052,
      2742672763,
      2604032198,
      2683796849,
      2461293480,
      2524268063,
      2284983834,
      2364738477,
      2175806836,
      2238787779,
      1569362073,
      1498123566,
      1409854455,
      1355396672,
      1317987909,
      1246755826,
      1192025387,
      1137557660,
      2072149281,
      2135122070,
      1912620623,
      1992383480,
      1753615357,
      1816598090,
      1627664531,
      1707420964,
      295390185,
      358241886,
      404320391,
      483945776,
      43990325,
      106832002,
      186451547,
      266083308,
      932423249,
      861060070,
      1041341759,
      986742920,
      613929101,
      542559546,
      756411363,
      701822548,
      3316196985,
      3244833742,
      3425377559,
      3370778784,
      3601682597,
      3530312978,
      3744426955,
      3689838204,
      3819031489,
      3881883254,
      3928223919,
      4007849240,
      4037393693,
      4100235434,
      4180117107,
      4259748804,
      2310601993,
      2373574846,
      2151335527,
      2231098320,
      2596047829,
      2659030626,
      2470359227,
      2550115596,
      2947551409,
      2876312838,
      2788305887,
      2733848168,
      3165939309,
      3094707162,
      3040238851,
      2985771188
    ];
    bzip2.array = function(bytes) {
      var bit = 0, byte = 0;
      var BITMASK = [0, 1, 3, 7, 15, 31, 63, 127, 255];
      return function(n) {
        var result = 0;
        while (n > 0) {
          var left = 8 - bit;
          if (n >= left) {
            result <<= left;
            result |= BITMASK[left] & bytes[byte++];
            bit = 0;
            n -= left;
          } else {
            result <<= n;
            result |= (bytes[byte] & BITMASK[n] << 8 - n - bit) >> 8 - n - bit;
            bit += n;
            n = 0;
          }
        }
        return result;
      };
    };
    bzip2.simple = function(srcbuffer, stream) {
      var bits = bzip2.array(srcbuffer);
      var size = bzip2.header(bits);
      var ret = false;
      var bufsize = 1e5 * size;
      var buf = new Int32Array(bufsize);
      do {
        ret = bzip2.decompress(bits, stream, buf, bufsize);
      } while (!ret);
    };
    bzip2.header = function(bits) {
      this.byteCount = new Int32Array(256);
      this.symToByte = new Uint8Array(256);
      this.mtfSymbol = new Int32Array(256);
      this.selectors = new Uint8Array(32768);
      if (bits(8 * 3) != 4348520) message.Error("No magic number found");
      var i = bits(8) - 48;
      if (i < 1 || i > 9) message.Error("Not a BZIP archive");
      return i;
    };
    bzip2.decompress = function(bits, stream, buf, bufsize, streamCRC) {
      var MAX_HUFCODE_BITS = 20;
      var MAX_SYMBOLS = 258;
      var SYMBOL_RUNA = 0;
      var SYMBOL_RUNB = 1;
      var GROUP_SIZE = 50;
      var crc = 0 ^ -1;
      for (var h = "", i = 0; i < 6; i++) h += bits(8).toString(16);
      if (h == "177245385090") {
        var finalCRC = bits(32) | 0;
        if (finalCRC !== streamCRC) message.Error("Error in bzip2: crc32 do not match");
        bits(null);
        return null;
      }
      if (h != "314159265359") message.Error("eek not valid bzip data");
      var crcblock = bits(32) | 0;
      if (bits(1)) message.Error("unsupported obsolete version");
      var origPtr = bits(24);
      if (origPtr > bufsize) message.Error("Initial position larger than buffer size");
      var t = bits(16);
      var symTotal = 0;
      for (i = 0; i < 16; i++) {
        if (t & 1 << 15 - i) {
          var k = bits(16);
          for (j = 0; j < 16; j++) {
            if (k & 1 << 15 - j) {
              this.symToByte[symTotal++] = 16 * i + j;
            }
          }
        }
      }
      var groupCount = bits(3);
      if (groupCount < 2 || groupCount > 6) message.Error("another error");
      var nSelectors = bits(15);
      if (nSelectors == 0) message.Error("meh");
      for (var i = 0; i < groupCount; i++) this.mtfSymbol[i] = i;
      for (var i = 0; i < nSelectors; i++) {
        for (var j = 0; bits(1); j++) if (j >= groupCount) message.Error("whoops another error");
        var uc = this.mtfSymbol[j];
        for (var k = j - 1; k >= 0; k--) {
          this.mtfSymbol[k + 1] = this.mtfSymbol[k];
        }
        this.mtfSymbol[0] = uc;
        this.selectors[i] = uc;
      }
      var symCount = symTotal + 2;
      var groups = [];
      var length = new Uint8Array(MAX_SYMBOLS), temp = new Uint16Array(MAX_HUFCODE_BITS + 1);
      var hufGroup;
      for (var j = 0; j < groupCount; j++) {
        t = bits(5);
        for (var i = 0; i < symCount; i++) {
          while (true) {
            if (t < 1 || t > MAX_HUFCODE_BITS) message.Error("I gave up a while ago on writing error messages");
            if (!bits(1)) break;
            if (!bits(1)) t++;
            else t--;
          }
          length[i] = t;
        }
        var minLen, maxLen;
        minLen = maxLen = length[0];
        for (var i = 1; i < symCount; i++) {
          if (length[i] > maxLen) maxLen = length[i];
          else if (length[i] < minLen) minLen = length[i];
        }
        hufGroup = groups[j] = {};
        hufGroup.permute = new Int32Array(MAX_SYMBOLS);
        hufGroup.limit = new Int32Array(MAX_HUFCODE_BITS + 1);
        hufGroup.base = new Int32Array(MAX_HUFCODE_BITS + 1);
        hufGroup.minLen = minLen;
        hufGroup.maxLen = maxLen;
        var base = hufGroup.base;
        var limit = hufGroup.limit;
        var pp = 0;
        for (var i = minLen; i <= maxLen; i++)
          for (var t = 0; t < symCount; t++)
            if (length[t] == i) hufGroup.permute[pp++] = t;
        for (i = minLen; i <= maxLen; i++) temp[i] = limit[i] = 0;
        for (i = 0; i < symCount; i++) temp[length[i]]++;
        pp = t = 0;
        for (i = minLen; i < maxLen; i++) {
          pp += temp[i];
          limit[i] = pp - 1;
          pp <<= 1;
          base[i + 1] = pp - (t += temp[i]);
        }
        limit[maxLen] = pp + temp[maxLen] - 1;
        base[minLen] = 0;
      }
      for (var i = 0; i < 256; i++) {
        this.mtfSymbol[i] = i;
        this.byteCount[i] = 0;
      }
      var runPos, count, symCount, selector;
      runPos = count = symCount = selector = 0;
      while (true) {
        if (!symCount--) {
          symCount = GROUP_SIZE - 1;
          if (selector >= nSelectors) message.Error("meow i'm a kitty, that's an error");
          hufGroup = groups[this.selectors[selector++]];
          base = hufGroup.base;
          limit = hufGroup.limit;
        }
        i = hufGroup.minLen;
        j = bits(i);
        while (true) {
          if (i > hufGroup.maxLen) message.Error("rawr i'm a dinosaur");
          if (j <= limit[i]) break;
          i++;
          j = j << 1 | bits(1);
        }
        j -= base[i];
        if (j < 0 || j >= MAX_SYMBOLS) message.Error("moo i'm a cow");
        var nextSym = hufGroup.permute[j];
        if (nextSym == SYMBOL_RUNA || nextSym == SYMBOL_RUNB) {
          if (!runPos) {
            runPos = 1;
            t = 0;
          }
          if (nextSym == SYMBOL_RUNA) t += runPos;
          else t += 2 * runPos;
          runPos <<= 1;
          continue;
        }
        if (runPos) {
          runPos = 0;
          if (count + t > bufsize) message.Error("Boom.");
          uc = this.symToByte[this.mtfSymbol[0]];
          this.byteCount[uc] += t;
          while (t--) buf[count++] = uc;
        }
        if (nextSym > symTotal) break;
        if (count >= bufsize) message.Error("I can't think of anything. Error");
        i = nextSym - 1;
        uc = this.mtfSymbol[i];
        for (var k = i - 1; k >= 0; k--) {
          this.mtfSymbol[k + 1] = this.mtfSymbol[k];
        }
        this.mtfSymbol[0] = uc;
        uc = this.symToByte[uc];
        this.byteCount[uc]++;
        buf[count++] = uc;
      }
      if (origPtr < 0 || origPtr >= count) message.Error("I'm a monkey and I'm throwing something at someone, namely you");
      var j = 0;
      for (var i = 0; i < 256; i++) {
        k = j + this.byteCount[i];
        this.byteCount[i] = j;
        j = k;
      }
      for (var i = 0; i < count; i++) {
        uc = buf[i] & 255;
        buf[this.byteCount[uc]] |= i << 8;
        this.byteCount[uc]++;
      }
      var pos = 0, current = 0, run = 0;
      if (count) {
        pos = buf[origPtr];
        current = pos & 255;
        pos >>= 8;
        run = -1;
      }
      count = count;
      var copies, previous, outbyte;
      while (count) {
        count--;
        previous = current;
        pos = buf[pos];
        current = pos & 255;
        pos >>= 8;
        if (run++ == 3) {
          copies = current;
          outbyte = previous;
          current = -1;
        } else {
          copies = 1;
          outbyte = current;
        }
        while (copies--) {
          crc = (crc << 8 ^ this.crcTable[(crc >> 24 ^ outbyte) & 255]) & 4294967295;
          stream(outbyte);
        }
        if (current != previous) run = 0;
      }
      crc = (crc ^ -1) >>> 0;
      if ((crc | 0) != (crcblock | 0)) message.Error("Error in bzip2: crc32 do not match");
      streamCRC = (crc ^ (streamCRC << 1 | streamCRC >>> 31)) & 4294967295;
      return streamCRC;
    };
    module2.exports = bzip2;
  }
});

// node_modules/.pnpm/unbzip2-stream@1.4.3/node_modules/unbzip2-stream/lib/bit_iterator.js
var require_bit_iterator = __commonJS({
  "node_modules/.pnpm/unbzip2-stream@1.4.3/node_modules/unbzip2-stream/lib/bit_iterator.js"(exports2, module2) {
    var BITMASK = [0, 1, 3, 7, 15, 31, 63, 127, 255];
    module2.exports = function bitIterator(nextBuffer) {
      var bit = 0, byte = 0;
      var bytes = nextBuffer();
      var f = function(n) {
        if (n === null && bit != 0) {
          bit = 0;
          byte++;
          return;
        }
        var result = 0;
        while (n > 0) {
          if (byte >= bytes.length) {
            byte = 0;
            bytes = nextBuffer();
          }
          var left = 8 - bit;
          if (bit === 0 && n > 0)
            f.bytesRead++;
          if (n >= left) {
            result <<= left;
            result |= BITMASK[left] & bytes[byte++];
            bit = 0;
            n -= left;
          } else {
            result <<= n;
            result |= (bytes[byte] & BITMASK[n] << 8 - n - bit) >> 8 - n - bit;
            bit += n;
            n = 0;
          }
        }
        return result;
      };
      f.bytesRead = 0;
      return f;
    };
  }
});

// node_modules/.pnpm/unbzip2-stream@1.4.3/node_modules/unbzip2-stream/index.js
var require_unbzip2_stream = __commonJS({
  "node_modules/.pnpm/unbzip2-stream@1.4.3/node_modules/unbzip2-stream/index.js"(exports2, module2) {
    var through = require_through();
    var bz2 = require_bzip2();
    var bitIterator = require_bit_iterator();
    module2.exports = unbzip2Stream2;
    function unbzip2Stream2() {
      var bufferQueue = [];
      var hasBytes = 0;
      var blockSize = 0;
      var broken = false;
      var done = false;
      var bitReader = null;
      var streamCRC = null;
      function decompressBlock(push) {
        if (!blockSize) {
          blockSize = bz2.header(bitReader);
          streamCRC = 0;
          return true;
        } else {
          var bufsize = 1e5 * blockSize;
          var buf = new Int32Array(bufsize);
          var chunk = [];
          var f = function(b) {
            chunk.push(b);
          };
          streamCRC = bz2.decompress(bitReader, f, buf, bufsize, streamCRC);
          if (streamCRC === null) {
            blockSize = 0;
            return false;
          } else {
            push(Buffer.from(chunk));
            return true;
          }
        }
      }
      var outlength = 0;
      function decompressAndQueue(stream) {
        if (broken) return;
        try {
          return decompressBlock(function(d) {
            stream.queue(d);
            if (d !== null) {
              outlength += d.length;
            } else {
            }
          });
        } catch (e) {
          stream.emit("error", e);
          broken = true;
          return false;
        }
      }
      return through(
        function write(data) {
          bufferQueue.push(data);
          hasBytes += data.length;
          if (bitReader === null) {
            bitReader = bitIterator(function() {
              return bufferQueue.shift();
            });
          }
          while (!broken && hasBytes - bitReader.bytesRead + 1 >= (25e3 + 1e5 * blockSize || 4)) {
            decompressAndQueue(this);
          }
        },
        function end(x) {
          while (!broken && bitReader && hasBytes > bitReader.bytesRead) {
            decompressAndQueue(this);
          }
          if (!broken) {
            if (streamCRC !== null)
              this.emit("error", new Error("input stream ended prematurely"));
            this.queue(null);
          }
        }
      );
    }
  }
});

// src/lib/demo/runAnalyzeUploadJob.ts
var import_server_only3 = __toESM(require_server_only());
var import_node_crypto = require("node:crypto");
var import_promises4 = require("node:fs/promises");
var import_node_os3 = require("node:os");
var import_node_path3 = require("node:path");

// src/lib/demo/helpers.ts
function str(row, ...keys) {
  for (const key of keys) {
    const v = row[key];
    if (v !== void 0 && v !== null && String(v).length > 0) {
      return String(v);
    }
  }
  return "";
}
function num(row, ...keys) {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return 0;
}
function steamIdOf(row, role = "user") {
  if (role === "attacker") {
    return str(
      row,
      "attacker_steamid",
      "attacker_steam_id",
      "attackerSteamid"
    );
  }
  if (role === "assister") {
    return str(
      row,
      "assister_steamid",
      "assister_steam_id",
      "assisterSteamid"
    );
  }
  if (role === "thrower") {
    return str(row, "thrower_steamid", "user_steamid", "steamid");
  }
  return str(row, "user_steamid", "steamid", "player_steamid");
}
function nameOf(row, role = "user") {
  if (role === "attacker") {
    return str(row, "attacker_name", "attackerName", "attacker");
  }
  if (role === "assister") {
    return str(row, "assister_name", "assisterName");
  }
  if (role === "thrower") {
    return str(row, "thrower_name", "user_name", "name");
  }
  return str(row, "user_name", "name", "player_name");
}
function roundOf(row) {
  const completed = num(row, "total_rounds_played", "round");
  return completed + 1;
}
function tickOf(row) {
  return num(row, "tick", "Tick");
}
function secondsBetween(tickA, tickB, tickRate = 64) {
  if (!tickRate) return 0;
  return Math.abs(tickB - tickA) / tickRate;
}
function normalizeSteamId(value) {
  if (value === void 0 || value === null) return "";
  return String(value).trim();
}

// src/lib/demo/scene.ts
function rowToPose(row) {
  const steamId = normalizeSteamId(str(row, "steamid", "steam_id"));
  if (!steamId || steamId === "0") return null;
  const health = num(row, "health");
  const aliveFlag = num(row, "is_alive");
  const alive = health > 0 || aliveFlag === 1 || row.health === void 0 && row.is_alive === void 0;
  return {
    steamId,
    name: str(row, "name") || steamId,
    team: num(row, "team_num", "team_number"),
    x: num(row, "X", "x"),
    y: num(row, "Y", "y"),
    z: num(row, "Z", "z"),
    yaw: num(row, "yaw"),
    alive,
    tick: tickOf(row)
  };
}
function buildSceneAtTick(demo, targetTick, roles, options) {
  if (!demo.motionTicks.length || !Number.isFinite(targetTick)) return void 0;
  const poses = demo.motionTicks.map(rowToPose).filter((p) => p !== null);
  if (poses.length === 0) return void 0;
  let bestTick = -1;
  let bestDist = Infinity;
  const ticks = new Set(poses.map((p) => p.tick));
  for (const t of ticks) {
    const dist = t <= targetTick ? targetTick - t : (t - targetTick) * 2 + 0.5;
    if (dist < bestDist) {
      bestDist = dist;
      bestTick = t;
    }
  }
  if (bestTick < 0) return void 0;
  const atTick = poses.filter((p) => p.tick === bestTick);
  const includeDead = options?.includeDead ?? true;
  const markers = [];
  for (const p of atTick) {
    if (!includeDead && !p.alive) continue;
    const role = roles[p.steamId] ?? "other";
    if (role === "other") continue;
    markers.push({
      steamId: p.steamId,
      name: p.name,
      team: p.team,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      role,
      alive: p.alive
    });
  }
  for (const [sid, role] of Object.entries(roles)) {
    if (markers.some((m) => m.steamId === sid)) continue;
    const p = atTick.find((x) => x.steamId === sid);
    if (!p) continue;
    markers.push({
      steamId: p.steamId,
      name: p.name,
      team: p.team,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      role,
      alive: p.alive
    });
  }
  if (markers.length === 0) return void 0;
  return {
    tick: bestTick,
    markers,
    focusSteamId: options?.focusSteamId
  };
}

// src/lib/demo/cheating.ts
var DEG = Math.PI / 180;
var AIM_ON_TARGET_DEG = 8;
var PRE_AIM_DEG = 10;
var WALL_MIN_DIST = 700;
var WALL_FAR_DIST = 1400;
var WALL_VERT_SEP = 56;
var RAGE_SNAP_DEG = 100;
var SPIN_TICK_DEG = 18;
var SPIN_STREAK_TICKS = 24;
var PRE_AIM_WINDOW_SEC = 1.25;
var PRE_AIM_HOLD_SEC = 0.25;
function angleDeltaDeg(a, b) {
  let d = (a - b + 540) % 360 - 180;
  if (d < -180) d += 360;
  return d;
}
function absYawDelta(a, b) {
  return Math.abs(angleDeltaDeg(a, b));
}
function viewForward(yaw, pitch) {
  const yawR = yaw * DEG;
  const pitchR = pitch * DEG;
  const cp = Math.cos(pitchR);
  return [Math.cos(yawR) * cp, Math.sin(yawR) * cp, -Math.sin(pitchR)];
}
function aimErrorDeg(from, to) {
  const eyeZ = from.z + 64;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z + 64 - eyeZ;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1) return 180;
  const [fx, fy, fz] = viewForward(from.yaw, from.pitch);
  const dot = (fx * dx + fy * dy + fz * dz) / len;
  const clamped = Math.min(1, Math.max(-1, dot));
  return Math.acos(clamped) / Math.PI * 180;
}
function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function isAliveRow(row) {
  const health = num(row, "health");
  if (health > 0) return true;
  const alive = num(row, "is_alive");
  if (alive === 1) return true;
  if (row.health === void 0 && row.is_alive === void 0) {
    return num(row, "X", "x") !== 0 || num(row, "Y", "y") !== 0;
  }
  return false;
}
function rowToPose2(row) {
  const steamId = normalizeSteamId(str(row, "steamid", "steam_id"));
  if (!steamId || steamId === "0") return null;
  return {
    steamId,
    name: str(row, "name") || steamId,
    tick: tickOf(row),
    x: num(row, "X", "x"),
    y: num(row, "Y", "y"),
    z: num(row, "Z", "z"),
    pitch: num(row, "pitch"),
    yaw: num(row, "yaw"),
    team: num(row, "team_num", "team_number"),
    alive: isAliveRow(row)
  };
}
function occlusionProxy(a, b) {
  const d = dist3(a, b);
  if (d < WALL_MIN_DIST) return false;
  if (Math.abs(a.z - b.z) >= WALL_VERT_SEP) return true;
  return d >= WALL_FAR_DIST;
}
function emptyScore(steamId, name) {
  return {
    steamId,
    name,
    wallLookScore: 0,
    wallLookSamples: 0,
    preAimFlags: 0,
    rageSnaps: 0,
    spinbotFlags: 0,
    cheatRisk: 0
  };
}
function computeRisk(s) {
  const wall = Math.min(40, s.wallLookScore * 0.45);
  const pre = Math.min(25, s.preAimFlags * 6);
  const rage = Math.min(25, s.rageSnaps * 4);
  const spin = Math.min(30, s.spinbotFlags * 15);
  return Math.min(100, Math.round(wall + pre + rage + spin));
}
function analyzeCheating(demo, players, tickRate) {
  const mistakes = [];
  const scores = /* @__PURE__ */ new Map();
  for (const p of players) {
    scores.set(p.steamId, emptyScore(p.steamId, p.name));
  }
  const poses = demo.motionTicks.map(rowToPose2).filter((p) => p !== null && p.alive);
  const byTick = /* @__PURE__ */ new Map();
  const byPlayer = /* @__PURE__ */ new Map();
  for (const pose of poses) {
    const tickList = byTick.get(pose.tick) ?? [];
    tickList.push(pose);
    byTick.set(pose.tick, tickList);
    const plist = byPlayer.get(pose.steamId) ?? [];
    plist.push(pose);
    byPlayer.set(pose.steamId, plist);
    if (!scores.has(pose.steamId)) {
      scores.set(pose.steamId, emptyScore(pose.steamId, pose.name));
    } else {
      const s = scores.get(pose.steamId);
      if (pose.name && s.name === s.steamId) s.name = pose.name;
    }
  }
  const wallHits = /* @__PURE__ */ new Map();
  const wallSamples = /* @__PURE__ */ new Map();
  for (const [, group] of byTick) {
    for (const observer of group) {
      wallSamples.set(
        observer.steamId,
        (wallSamples.get(observer.steamId) ?? 0) + 1
      );
      let lookingOccluded = false;
      for (const enemy of group) {
        if (enemy.steamId === observer.steamId) continue;
        if (observer.team > 0 && enemy.team > 0 && observer.team === enemy.team) {
          continue;
        }
        if (!occlusionProxy(observer, enemy)) continue;
        if (aimErrorDeg(observer, enemy) <= AIM_ON_TARGET_DEG) {
          lookingOccluded = true;
          break;
        }
      }
      if (lookingOccluded) {
        wallHits.set(
          observer.steamId,
          (wallHits.get(observer.steamId) ?? 0) + 1
        );
      }
    }
  }
  for (const [sid, sampleCount] of wallSamples) {
    const s = scores.get(sid) ?? emptyScore(sid, sid);
    const hits = wallHits.get(sid) ?? 0;
    s.wallLookSamples = sampleCount;
    s.wallLookScore = sampleCount > 0 ? Math.round(hits / sampleCount * 1e3) / 10 : 0;
    scores.set(sid, s);
    if (s.wallLookScore >= 12 && sampleCount >= 40) {
      mistakes.push({
        steamId: sid,
        playerName: s.name,
        round: 0,
        type: "cheat",
        message: `Elevated wall-look score ${s.wallLookScore}% (aiming at distant/occluded enemies \u2014 heuristic, not proof)`,
        severity: s.wallLookScore >= 22 ? "danger" : "warn"
      });
    }
  }
  for (const [sid, history] of byPlayer) {
    const sorted = [...history].sort((a, b) => a.tick - b.tick);
    const s = scores.get(sid) ?? emptyScore(sid, sorted[0]?.name ?? sid);
    let spinStreak = 0;
    let spinEpisodes = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const tickGap = cur.tick - prev.tick;
      if (tickGap <= 0 || tickGap > tickRate) {
        spinStreak = 0;
        continue;
      }
      const yawJump = absYawDelta(cur.yaw, prev.yaw);
      const perTick = yawJump / tickGap;
      if (yawJump >= RAGE_SNAP_DEG && tickGap <= Math.max(4, tickRate / 8)) {
        s.rageSnaps += 1;
        if (s.rageSnaps <= 8) {
          mistakes.push({
            steamId: sid,
            playerName: s.name,
            round: 0,
            type: "cheat",
            message: `Rage-like aim snap ~${Math.round(yawJump)}\xB0 (viewangle jump)`,
            severity: "danger"
          });
        }
      }
      if (perTick >= SPIN_TICK_DEG) {
        spinStreak += tickGap;
        if (spinStreak >= SPIN_STREAK_TICKS) {
          spinEpisodes += 1;
          spinStreak = 0;
        }
      } else {
        spinStreak = 0;
      }
    }
    s.spinbotFlags = spinEpisodes;
    if (spinEpisodes > 0) {
      mistakes.push({
        steamId: sid,
        playerName: s.name,
        round: 0,
        type: "cheat",
        message: `Possible spinbot / continuous angle spam (${spinEpisodes} episode${spinEpisodes === 1 ? "" : "s"})`,
        severity: "danger"
      });
    }
    scores.set(sid, s);
  }
  const sortedTicks = [...byTick.keys()].sort((a, b) => a - b);
  function posesNear(tick) {
    let best = -1;
    for (const t of sortedTicks) {
      if (t > tick) break;
      best = t;
    }
    if (best < 0) return [];
    if (tick - best > tickRate * 0.5) return [];
    return byTick.get(best) ?? [];
  }
  for (const death of demo.deaths) {
    const attackerId = steamIdOf(death, "attacker");
    const victimId = steamIdOf(death, "user");
    if (!attackerId || !victimId || attackerId === victimId) continue;
    const deathTick = tickOf(death);
    if (!deathTick) continue;
    const round = roundOf(death);
    const windowStart = deathTick - Math.round(PRE_AIM_WINDOW_SEC * tickRate);
    const holdNeed = Math.round(PRE_AIM_HOLD_SEC * tickRate);
    let hold = 0;
    let flagged = false;
    for (const t of sortedTicks) {
      if (t < windowStart || t >= deathTick) continue;
      const group = byTick.get(t) ?? [];
      const attacker = group.find((p) => p.steamId === attackerId);
      const victim = group.find((p) => p.steamId === victimId);
      if (!attacker || !victim) {
        hold = 0;
        continue;
      }
      if (!occlusionProxy(attacker, victim)) {
        hold = 0;
        continue;
      }
      if (aimErrorDeg(attacker, victim) <= PRE_AIM_DEG) {
        hold += 1;
        if (hold >= Math.max(2, Math.ceil(holdNeed / 16))) {
          flagged = true;
          break;
        }
      } else {
        hold = 0;
      }
    }
    if (!flagged) {
      let continuous = 0;
      for (let t = windowStart; t < deathTick; t += Math.max(4, Math.floor(tickRate / 16))) {
        const group = posesNear(t);
        const attacker = group.find((p) => p.steamId === attackerId);
        const victim = group.find((p) => p.steamId === victimId);
        if (!attacker || !victim || !occlusionProxy(attacker, victim)) {
          continuous = 0;
          continue;
        }
        if (aimErrorDeg(attacker, victim) <= PRE_AIM_DEG) {
          continuous += Math.max(4, Math.floor(tickRate / 16));
          if (continuous >= holdNeed) {
            flagged = true;
            break;
          }
        } else {
          continuous = 0;
        }
      }
    }
    if (flagged) {
      const s = scores.get(attackerId) ?? emptyScore(attackerId, nameOf(death, "attacker"));
      s.preAimFlags += 1;
      scores.set(attackerId, s);
      const sceneTick = deathTick - Math.round(0.4 * tickRate);
      mistakes.push({
        steamId: attackerId,
        playerName: s.name,
        round,
        type: "cheat",
        message: `Pre-aim on ${nameOf(death, "user") || "enemy"} through occlusion before kill`,
        severity: "warn",
        scene: buildSceneAtTick(
          demo,
          sceneTick,
          {
            [attackerId]: "attacker",
            [victimId]: "victim"
          },
          { focusSteamId: attackerId }
        )
      });
    }
  }
  const cheatScores = [...scores.values()].map((s) => {
    s.cheatRisk = computeRisk(s);
    return s;
  });
  cheatScores.sort((a, b) => b.cheatRisk - a.cheatRisk);
  return { mistakes, cheatScores };
}

// src/lib/demo/buildReplay.ts
function isAliveRow2(row) {
  const health = num(row, "health");
  if (health > 0) return true;
  if (num(row, "is_alive") === 1) return true;
  if (row.health === void 0 && row.is_alive === void 0) {
    return num(row, "X", "x") !== 0 || num(row, "Y", "y") !== 0;
  }
  return false;
}
function poseFromRow(row) {
  const steamId = normalizeSteamId(str(row, "steamid", "steam_id"));
  if (!steamId || steamId === "0") return null;
  return {
    steamId,
    x: num(row, "X", "x"),
    y: num(row, "Y", "y"),
    yaw: num(row, "yaw", "eye_yaw", "ang_y"),
    alive: isAliveRow2(row),
    team: num(row, "team_num", "team_number")
  };
}
function eventCoords(row, fallback) {
  const x = num(row, "x", "X");
  const y = num(row, "y", "Y");
  if (x !== 0 || y !== 0) return { x, y };
  if (fallback) return fallback;
  return { x: 0, y: 0 };
}
function nearestPose(frames, tick, steamId) {
  if (frames.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const f of frames) {
    const d = Math.abs(f.tick - tick);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
    if (f.tick > tick && bestDist < 64) break;
  }
  return best?.players.find((p) => p.steamId === steamId) ?? null;
}
function winnerTeamOf(row) {
  for (const key of ["winner", "winner_team"]) {
    const v = row[key];
    if (v === void 0 || v === null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (n === 2 || n === 3) return n;
    if (n === 0) return 2;
    if (n === 1) return 3;
    const label = String(v).toLowerCase();
    if (label.includes("counter") || label === "ct") return 3;
    if (label.includes("terror") || label === "t") return 2;
  }
  const message = str(row, "message").toLowerCase();
  if (message.includes("counter") || message.includes("_ct")) return 3;
  if (message.includes("terror") || message.includes("_t")) return 2;
  return void 0;
}
function buildRounds(demo, endTick) {
  const starts = [...demo.roundStarts].map((r) => ({ round: roundOf(r), tick: tickOf(r) })).filter((r) => r.tick > 0).sort((a, b) => a.tick - b.tick);
  const ends = [...demo.roundEnds].map((r) => ({
    round: roundOf(r),
    tick: tickOf(r),
    winner: winnerTeamOf(r)
  })).filter((r) => r.tick > 0).sort((a, b) => a.tick - b.tick);
  const mvpsByRound = /* @__PURE__ */ new Map();
  for (const row of demo.roundMvps ?? []) {
    const round = roundOf(row);
    const steamId = steamIdOf(row, "user") || normalizeSteamId(str(row, "steamid", "user_steamid"));
    if (round > 0 && steamId) mvpsByRound.set(round, steamId);
  }
  if (starts.length === 0) {
    return [{ round: 1, startTick: 0, endTick }];
  }
  const rounds = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const nextStart = starts[i + 1];
    const endFromEvent = ends.find(
      (e) => e.tick > start.tick && (!nextStart || e.tick <= nextStart.tick)
    );
    const endTickRound = endFromEvent?.tick ?? nextStart?.tick ?? endTick;
    const roundNum = start.round || i + 1;
    const winnerTeam = endFromEvent?.winner;
    rounds.push({
      round: roundNum,
      startTick: start.tick,
      endTick: Math.max(start.tick + 1, endTickRound),
      winnerTeam,
      mvpSteamId: mvpsByRound.get(roundNum)
    });
  }
  return rounds;
}
function durationForKind(kind, tickRate) {
  switch (kind) {
    case "smoke":
      return Math.round(18 * tickRate);
    case "molotov":
      return Math.round(7 * tickRate);
    case "he":
      return Math.round(2.5 * tickRate);
    case "flash":
      return Math.round(1.4 * tickRate);
    case "kill":
      return Math.round(2.5 * tickRate);
    default:
      return Math.round(2 * tickRate);
  }
}
function entityIdOf(row) {
  const id = str(row, "entityid", "entity_id", "EntityID");
  return id;
}
function matchExpireTick(start, expires, used, tickRate, maxSeconds) {
  const startTick = tickOf(start);
  const maxDelta = Math.round(tickRate * maxSeconds);
  const eid = entityIdOf(start);
  const sx = num(start, "x", "X");
  const sy = num(start, "y", "Y");
  if (eid) {
    for (let i = 0; i < expires.length; i++) {
      if (used.has(i)) continue;
      const row = expires[i];
      if (entityIdOf(row) !== eid) continue;
      const t = tickOf(row);
      if (t <= startTick || t - startTick > maxDelta) continue;
      const minTicks = Math.round(tickRate * (maxSeconds > 15 ? 5 : 2));
      if (t - startTick < minTicks) continue;
      used.add(i);
      return t;
    }
  }
  let bestI = -1;
  let bestScore = Infinity;
  for (let i = 0; i < expires.length; i++) {
    if (used.has(i)) continue;
    const row = expires[i];
    const t = tickOf(row);
    if (t <= startTick || t - startTick > maxDelta) continue;
    const dx = num(row, "x", "X") - sx;
    const dy = num(row, "y", "Y") - sy;
    const dist = Math.hypot(dx, dy);
    const score = dist + (t - startTick) * 0.02;
    if (score < bestScore) {
      bestScore = score;
      bestI = i;
    }
  }
  if (bestI >= 0 && bestScore < 400) {
    const t = tickOf(expires[bestI]);
    const minTicks = Math.round(tickRate * (maxSeconds > 15 ? 5 : 2));
    if (t - startTick < minTicks) return null;
    used.add(bestI);
    return t;
  }
  return null;
}
function mapGrenadeType(raw) {
  const t = raw.toLowerCase().replace(/\s+/g, "");
  if (t.includes("flash")) return "flash";
  if (t.includes("smoke")) return "smoke";
  if (t.includes("hegrenade") || t === "he" || t.includes("explosive")) {
    return "he";
  }
  if (t.includes("molotov") || t.includes("incendiary") || t.includes("inferno") || t.includes("firebomb")) {
    return "molotov";
  }
  return null;
}
function buildGrenadeFlights(rows) {
  const byEntity = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const id = str(row, "entity_id", "entityId", "EntityId");
    if (!id) continue;
    const list = byEntity.get(id) ?? [];
    list.push(row);
    byEntity.set(id, list);
  }
  const flights = [];
  for (const [entityId, samples] of byEntity) {
    const sorted = [...samples].sort((a, b) => tickOf(a) - tickOf(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const kind = mapGrenadeType(str(first, "grenade_type", "grenadeType", "weapon"));
    if (!kind) continue;
    const steamId = normalizeSteamId(
      str(first, "steamid", "thrower_steamid", "steam_id")
    );
    const throwX = num(first, "x", "X");
    const throwY = num(first, "y", "Y");
    const endX = num(last, "x", "X");
    const endY = num(last, "y", "Y");
    if (throwX === 0 && throwY === 0 || endX === 0 && endY === 0) continue;
    flights.push({
      entityId,
      kind,
      steamId,
      name: str(first, "name", "thrower_name") || steamId,
      throwTick: tickOf(first),
      throwX,
      throwY,
      endTick: tickOf(last),
      endX,
      endY,
      used: false
    });
  }
  return flights.sort((a, b) => a.throwTick - b.throwTick);
}
function matchFlight(flights, kind, throwerId, detonateTick, detonateX, detonateY, tickRate) {
  const window = Math.max(64, tickRate * 3);
  let best = null;
  let bestScore = Infinity;
  for (const f of flights) {
    if (f.used || f.kind !== kind) continue;
    if (throwerId && f.steamId && f.steamId !== throwerId) continue;
    const tickDelta = Math.abs(f.endTick - detonateTick);
    if (tickDelta > window) continue;
    const dist = Math.hypot(f.endX - detonateX, f.endY - detonateY);
    const score = tickDelta + dist / 50;
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  if (best) best.used = true;
  return best;
}
function collectFlashBlinds(demo, flashTick, throwerId, tickRate, teamById) {
  const window = Math.max(8, Math.round(tickRate * 0.35));
  const blinds = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of demo.blinds) {
    const t = tickOf(row);
    if (Math.abs(t - flashTick) > window) continue;
    const attackerId = steamIdOf(row, "attacker");
    if (throwerId && attackerId && attackerId !== throwerId) continue;
    const victimId = steamIdOf(row, "user");
    if (!victimId || victimId === throwerId || seen.has(victimId)) continue;
    const duration = num(row, "blind_duration", "flash_duration", "duration");
    if (duration > 0 && duration < 0.3) continue;
    seen.add(victimId);
    blinds.push({
      steamId: victimId,
      name: nameOf(row, "user") || victimId,
      duration: duration || 1,
      team: teamById.get(victimId) ?? 0
    });
  }
  blinds.sort((a, b) => b.duration - a.duration);
  return blinds;
}
function collectNadeDamage(demo, kind, startTick, endTick, throwerId, tickRate) {
  const pad = Math.round(tickRate * (kind === "he" ? 0.5 : 0.25));
  const from = startTick - pad;
  const to = endTick + pad;
  let total = 0;
  for (const hurt of demo.hurts) {
    const t = tickOf(hurt);
    if (t < from || t > to) continue;
    const weapon = str(hurt, "weapon").toLowerCase();
    const isHe = weapon.includes("hegrenade");
    const isFire = weapon.includes("inferno") || weapon.includes("molotov") || weapon.includes("incendiary");
    if (kind === "he" && !isHe) continue;
    if (kind === "molotov" && !isFire) continue;
    if (throwerId) {
      const attacker = steamIdOf(hurt, "attacker");
      if (attacker && attacker !== throwerId) continue;
    }
    total += Math.max(0, num(hurt, "dmg_health", "dmg_health_real"));
  }
  return Math.round(total);
}
function buildReplay(demo, players, mapName, tickRate) {
  const byTick = /* @__PURE__ */ new Map();
  for (const row of demo.motionTicks) {
    const tick = tickOf(row);
    const pose = poseFromRow(row);
    if (!pose || !tick) continue;
    const list = byTick.get(tick) ?? [];
    list.push(pose);
    byTick.set(tick, list);
  }
  const frames = [...byTick.entries()].sort((a, b) => a[0] - b[0]).map(([tick, poses]) => ({ tick, players: poses }));
  if (frames.length < 2) return null;
  const startTick = frames[0].tick;
  const endTick = frames[frames.length - 1].tick;
  const rosterMap = /* @__PURE__ */ new Map();
  for (const p of players) {
    rosterMap.set(p.steamId, {
      steamId: p.steamId,
      name: p.name,
      team: p.team
    });
  }
  for (const f of frames) {
    for (const pose of f.players) {
      if (!rosterMap.has(pose.steamId)) {
        rosterMap.set(pose.steamId, {
          steamId: pose.steamId,
          name: pose.steamId,
          team: pose.team
        });
      } else if (pose.team > 0) {
        const cur = rosterMap.get(pose.steamId);
        if (!cur.team) cur.team = pose.team;
      }
    }
  }
  const teamById = new Map(
    [...rosterMap.values()].map((p) => [p.steamId, p.team])
  );
  const flights = buildGrenadeFlights(demo.grenadeTrajectories);
  const events = [];
  for (const row of demo.deaths) {
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    if (!victimId) continue;
    const tick = tickOf(row);
    const victimPose = nearestPose(frames, tick, victimId);
    const coords = eventCoords(row, victimPose);
    events.push({
      tick,
      round: roundOf(row),
      kind: "kill",
      x: coords.x,
      y: coords.y,
      actorSteamId: attackerId || void 0,
      actorName: nameOf(row, "attacker") || void 0,
      actorTeam: attackerId ? teamById.get(attackerId) : void 0,
      targetSteamId: victimId,
      targetName: nameOf(row, "user") || void 0,
      durationTicks: durationForKind("kill", tickRate)
    });
  }
  const nadeSources = [
    { rows: demo.flashDetonates, kind: "flash", maxLifetimeSec: 6 },
    { rows: demo.heDetonates, kind: "he", maxLifetimeSec: 2 },
    {
      rows: demo.smokeDetonates,
      kind: "smoke",
      expires: demo.smokeExpires ?? [],
      maxLifetimeSec: 25
    },
    {
      rows: demo.molotovDetonates,
      kind: "molotov",
      expires: demo.molotovExpires ?? [],
      maxLifetimeSec: 12
    }
  ];
  const smokeExpireUsed = /* @__PURE__ */ new Set();
  const mollyExpireUsed = /* @__PURE__ */ new Set();
  for (const { rows, kind, expires, maxLifetimeSec } of nadeSources) {
    for (const row of rows) {
      const tick = tickOf(row);
      const throwerId = steamIdOf(row, "thrower") || steamIdOf(row, "user") || void 0;
      const throwerAtDetonate = throwerId ? nearestPose(frames, tick, throwerId) : null;
      const coords = eventCoords(row, throwerAtDetonate);
      if (coords.x === 0 && coords.y === 0 && !throwerAtDetonate) continue;
      const flight = matchFlight(
        flights,
        kind,
        throwerId,
        tick,
        coords.x,
        coords.y,
        tickRate
      );
      let throwX = flight?.throwX;
      let throwY = flight?.throwY;
      let throwTick = flight?.throwTick;
      if (throwX == null || throwY == null) {
        const earlyTick = tick - Math.round(tickRate * 1.5);
        const earlyPose = throwerId ? nearestPose(frames, earlyTick, throwerId) : null;
        if (earlyPose) {
          throwX = earlyPose.x;
          throwY = earlyPose.y;
          throwTick = earlyTick;
        } else if (throwerAtDetonate) {
          throwX = throwerAtDetonate.x;
          throwY = throwerAtDetonate.y;
          throwTick = tick;
        }
      }
      const popX = coords.x === 0 && coords.y === 0 && flight ? flight.endX : coords.x;
      const popY = coords.x === 0 && coords.y === 0 && flight ? flight.endY : coords.y;
      let durationTicks = durationForKind(kind, tickRate);
      let durationEstimated = kind === "smoke" || kind === "molotov";
      if (expires && expires.length > 0) {
        const used = kind === "smoke" ? smokeExpireUsed : mollyExpireUsed;
        const expireTick = matchExpireTick(
          row,
          expires,
          used,
          tickRate,
          maxLifetimeSec
        );
        if (expireTick != null) {
          const measured = expireTick - tick;
          const minOk = Math.round(tickRate * (kind === "smoke" ? 12 : 4));
          const maxOk = Math.round(tickRate * (kind === "smoke" ? 22 : 9));
          if (measured >= minOk && measured <= maxOk) {
            durationTicks = measured;
            durationEstimated = false;
          }
        }
      }
      const event = {
        tick,
        round: roundOf(row),
        kind,
        x: popX,
        y: popY,
        actorSteamId: throwerId || flight?.steamId,
        actorName: nameOf(row, "thrower") || nameOf(row, "user") || flight?.name || void 0,
        actorTeam: throwerId || flight?.steamId ? teamById.get(throwerId || flight.steamId) : void 0,
        durationTicks,
        durationEstimated: kind === "smoke" || kind === "molotov" ? durationEstimated : void 0,
        throwX,
        throwY,
        throwTick
      };
      if (kind === "flash") {
        event.blinds = collectFlashBlinds(
          demo,
          tick,
          throwerId || flight?.steamId,
          tickRate,
          teamById
        );
        const maxBlindSec = event.blinds.reduce(
          (m, b) => Math.max(m, b.duration),
          0
        );
        if (maxBlindSec > 0) {
          event.durationTicks = Math.max(
            durationTicks,
            Math.round(maxBlindSec * tickRate)
          );
        }
      }
      if (kind === "he" || kind === "molotov") {
        event.damage = collectNadeDamage(
          demo,
          kind,
          tick,
          tick + durationTicks,
          throwerId || flight?.steamId,
          tickRate
        );
      }
      events.push(event);
    }
  }
  events.sort((a, b) => a.tick - b.tick);
  const rounds = buildRounds(demo, endTick);
  for (const ev of events) {
    if (ev.kind !== "molotov" || ev.durationTicks == null) continue;
    ev.damage = collectNadeDamage(
      demo,
      "molotov",
      ev.tick,
      ev.tick + ev.durationTicks,
      ev.actorSteamId,
      tickRate
    );
  }
  return {
    tickRate,
    mapName,
    startTick,
    endTick,
    players: [...rosterMap.values()],
    frames,
    events,
    rounds
  };
}

// src/lib/demo/economy.ts
var FULL_BUY_EQUIPMENT = 4e3;
var FORCE_BUY_CASH_MAX = 3e3;
var FORCE_BUY_EQUIPMENT_MIN = 2500;
var GUN_ROUND_MIN_EQUIPMENT = 3500;
function analyzeEconomy(demo) {
  const mistakes = [];
  if (demo.freezeTicks.length > 0) {
    for (const row of demo.freezeTicks) {
      const steamId = normalizeSteamId(
        str(row, "steamid", "steam_id", "player_steamid")
      );
      if (!steamId || steamId === "0") continue;
      const name = str(row, "name", "player_name") || steamId;
      const round = roundOf(row);
      const cash = num(row, "balance", "m_iAccount", "account");
      const armor = num(row, "armor_value", "m_ArmorValue", "armor");
      const equip = num(
        row,
        "equipment_value_this_round",
        "equipment_value",
        "m_unCurrentEquipmentValue"
      );
      const alive = num(row, "is_alive", "m_bIsAlive");
      if (alive === 0) continue;
      if (equip >= GUN_ROUND_MIN_EQUIPMENT && armor <= 0) {
        mistakes.push({
          steamId,
          playerName: name,
          round,
          type: "economy",
          message: `Gun round without armor (equip ~$${equip})`,
          severity: "warn"
        });
      }
      if (cash > 0 && cash <= FORCE_BUY_CASH_MAX && equip >= FORCE_BUY_EQUIPMENT_MIN) {
        mistakes.push({
          steamId,
          playerName: name,
          round,
          type: "economy",
          message: `Likely force-buy: $${cash} cash with ~$${equip} equipment`,
          severity: "info"
        });
      }
    }
    return dedupeMistakes(mistakes);
  }
  for (const row of demo.deaths) {
    const victimId = steamIdOf(row, "user");
    if (!victimId) continue;
    const armor = num(row, "user_armor", "armor");
    if (armor > 0) continue;
    const round = roundOf(row);
    const gunRound = demo.deaths.some((d) => {
      if (roundOf(d) !== round) return false;
      const w = str(d, "weapon").toLowerCase();
      return w.includes("ak47") || w.includes("m4a") || w.includes("awp") || w.includes("aug") || w.includes("sg556") || w.includes("galilar") || w.includes("famas");
    });
    if (!gunRound) continue;
    mistakes.push({
      steamId: victimId,
      playerName: nameOf(row, "user"),
      round,
      type: "economy",
      message: "Died without armor on a gun round",
      severity: "warn"
    });
  }
  return dedupeMistakes(mistakes);
}
function dedupeMistakes(mistakes) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const m of mistakes) {
    const key = `${m.steamId}|${m.round}|${m.type}|${m.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  if (out.filter((m) => m.message.includes("Died without armor")).length > 30) {
    return out.filter((m) => !m.message.includes("Died without armor"));
  }
  void FULL_BUY_EQUIPMENT;
  return out;
}

// src/lib/demo/opening.ts
var TRADE_WINDOW_SECONDS = 5;
function analyzeOpeningAndTrades(demo, players, tickRate) {
  const teamById = new Map(players.map((p) => [p.steamId, p.team]));
  const nameById = new Map(players.map((p) => [p.steamId, p.name]));
  const updated = players.map((p) => ({ ...p }));
  const byId = new Map(updated.map((p) => [p.steamId, p]));
  const deathsSorted = [...demo.deaths].sort(
    (a, b) => tickOf(a) - tickOf(b)
  );
  const openings = [];
  const seenRounds = /* @__PURE__ */ new Set();
  for (const row of deathsSorted) {
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    if (!attackerId || !victimId || attackerId === victimId) continue;
    const round = roundOf(row);
    if (seenRounds.has(round)) continue;
    seenRounds.add(round);
    openings.push({
      round,
      tick: tickOf(row),
      attackerId,
      attackerName: nameOf(row, "attacker") || nameById.get(attackerId) || attackerId,
      attackerTeam: teamById.get(attackerId) ?? num(row, "attacker_team_num"),
      victimId,
      victimName: nameOf(row, "user") || nameById.get(victimId) || victimId,
      victimTeam: teamById.get(victimId) ?? num(row, "user_team_num")
    });
  }
  const mistakes = [];
  for (const opening of openings) {
    const tradeKill = deathsSorted.find((row) => {
      if (roundOf(row) !== opening.round) return false;
      const tick = tickOf(row);
      if (tick <= opening.tick) return false;
      if (secondsBetween(opening.tick, tick, tickRate) > TRADE_WINDOW_SECONDS) {
        return false;
      }
      const attackerId = steamIdOf(row, "attacker");
      const victimId = steamIdOf(row, "user");
      if (victimId !== opening.attackerId) return false;
      if (!attackerId || attackerId === opening.victimId) return false;
      const traderTeam = teamById.get(attackerId);
      const victimTeam = opening.victimTeam;
      if (traderTeam && victimTeam && traderTeam === victimTeam) return true;
      if (!traderTeam || !victimTeam) return true;
      return false;
    });
    const victim = byId.get(opening.victimId);
    if (tradeKill) {
      if (victim) victim.tradedDeaths += 1;
      continue;
    }
    if (victim) victim.missedTrades += 1;
    const teammates = updated.filter(
      (p) => p.steamId !== opening.victimId && opening.victimTeam > 0 && p.team === opening.victimTeam
    );
    const roles = {
      [opening.victimId]: "victim",
      [opening.attackerId]: "attacker"
    };
    for (const mate of teammates) {
      roles[mate.steamId] = "teammate";
    }
    const scene = buildSceneAtTick(demo, opening.tick, roles, {
      includeDead: true,
      focusSteamId: opening.victimId
    });
    const mateNames = teammates.map((t) => t.name).slice(0, 4);
    const mateHint = mateNames.length > 0 ? ` \u2014 teammates nearby: ${mateNames.join(", ")}` : "";
    mistakes.push({
      steamId: opening.victimId,
      playerName: opening.victimName,
      round: opening.round,
      type: "trade",
      message: `Missed trade: ${opening.victimName} died in opening vs ${opening.attackerName} (no trade within ${TRADE_WINDOW_SECONDS}s)${mateHint}`,
      severity: "warn",
      relatedSteamIds: teammates.map((t) => t.steamId),
      scene
    });
  }
  return { mistakes, players: updated };
}

// src/lib/demo/parse.ts
var import_demoparser2 = require("@laihoe/demoparser2");
function asRows(value) {
  if (!Array.isArray(value)) return [];
  return value;
}
function asPlayerInfo(value) {
  if (!Array.isArray(value)) return [];
  return value;
}
function estimateDuration(header, deaths, roundEnds) {
  let duration = Number(header.playback_ticks);
  if (!Number.isFinite(duration) || duration <= 0) {
    duration = 0;
    for (const row of deaths) {
      const t = Number(row.tick ?? row.Tick ?? 0);
      if (t > duration) duration = t;
    }
    for (const row of roundEnds) {
      const t = Number(row.tick ?? row.Tick ?? 0);
      if (t > duration) duration = t;
    }
  }
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}
function buildSampleTicks(duration, maxSamples) {
  if (duration <= 0) return [];
  const step = Math.max(4, Math.ceil(duration / maxSamples));
  const ticks = [];
  for (let t = 0; t <= duration; t += step) {
    ticks.push(t);
  }
  return ticks;
}
function parseDemoFile(path, onProgress) {
  const report = onProgress ?? (() => {
  });
  report("Reading demo header\u2026", 15);
  const header = (0, import_demoparser2.parseHeader)(path) ?? {};
  const playerInfo = asPlayerInfo((0, import_demoparser2.parsePlayerInfo)(path));
  report("Parsing kill & damage events\u2026", 18);
  const deaths = asRows(
    (0, import_demoparser2.parseEvent)(path, "player_death", [], [
      "total_rounds_played",
      "round"
    ])
  );
  const hurts = asRows(
    (0, import_demoparser2.parseEvent)(path, "player_hurt", [], ["total_rounds_played"])
  );
  report("Parsing utility events\u2026", 25);
  const blinds = asRows(
    (0, import_demoparser2.parseEvent)(path, "player_blind", [], ["total_rounds_played"])
  );
  const flashDetonates = asRows(
    (0, import_demoparser2.parseEvent)(path, "flashbang_detonate", [], ["total_rounds_played"])
  );
  const heDetonates = asRows(
    (0, import_demoparser2.parseEvent)(path, "hegrenade_detonate", [], ["total_rounds_played"])
  );
  const smokeDetonates = asRows(
    (0, import_demoparser2.parseEvent)(path, "smokegrenade_detonate", [], ["total_rounds_played"])
  );
  let smokeExpires = [];
  try {
    smokeExpires = asRows(
      (0, import_demoparser2.parseEvent)(path, "smokegrenade_expired", [], ["total_rounds_played"])
    );
  } catch {
    smokeExpires = [];
  }
  const molotovDetonates = asRows(
    (0, import_demoparser2.parseEvent)(path, "inferno_startburn", [], ["total_rounds_played"])
  );
  let molotovExpires = [];
  try {
    molotovExpires = asRows(
      (0, import_demoparser2.parseEvent)(path, "inferno_expire", [], ["total_rounds_played"])
    );
  } catch {
    molotovExpires = [];
  }
  try {
    const extinguish = asRows(
      (0, import_demoparser2.parseEvent)(path, "inferno_extinguish", [], ["total_rounds_played"])
    );
    if (extinguish.length > 0) {
      molotovExpires = [...molotovExpires, ...extinguish];
    }
  } catch {
  }
  report("Parsing round timeline\u2026", 35);
  const roundStarts = asRows(
    (0, import_demoparser2.parseEvent)(path, "round_start", [], ["total_rounds_played"])
  );
  const roundFreezeEnds = asRows(
    (0, import_demoparser2.parseEvent)(path, "round_freeze_end", [], ["total_rounds_played"])
  );
  const roundEnds = asRows(
    (0, import_demoparser2.parseEvent)(path, "round_end", [], ["total_rounds_played"])
  );
  let roundMvps = [];
  try {
    roundMvps = asRows(
      (0, import_demoparser2.parseEvent)(path, "round_mvp", [], ["total_rounds_played"])
    );
  } catch {
    roundMvps = [];
  }
  const freezeTickNumbers = roundFreezeEnds.map((row) => Number(row.tick ?? row.Tick ?? NaN)).filter((t) => Number.isFinite(t));
  report("Parsing freeze-time economy\u2026", 40);
  let freezeTicks = [];
  if (freezeTickNumbers.length > 0) {
    try {
      freezeTicks = asRows(
        (0, import_demoparser2.parseTicks)(
          path,
          [
            "balance",
            "armor_value",
            "has_helmet",
            "equipment_value_this_round",
            "team_num",
            "is_alive",
            "total_rounds_played"
          ],
          freezeTickNumbers
        )
      );
    } catch {
      freezeTicks = [];
    }
  }
  const duration = estimateDuration(header, deaths, roundEnds);
  let motionTicks = [];
  const sampleTicks = buildSampleTicks(duration, 1200);
  report("Parsing motion frames (slowest step)\u2026", 45);
  if (sampleTicks.length > 0) {
    try {
      motionTicks = asRows(
        (0, import_demoparser2.parseTicks)(
          path,
          ["X", "Y", "Z", "pitch", "yaw", "team_num", "health", "is_alive"],
          sampleTicks
        )
      );
    } catch {
      motionTicks = [];
    }
  }
  report("Parsing grenade trajectories\u2026", 70);
  let grenadeTrajectories = [];
  try {
    grenadeTrajectories = asRows((0, import_demoparser2.parseGrenades)(path));
  } catch {
    grenadeTrajectories = [];
  }
  report("Parse complete", 75);
  return {
    path,
    header,
    playerInfo,
    deaths,
    hurts,
    blinds,
    flashDetonates,
    heDetonates,
    smokeDetonates,
    smokeExpires,
    molotovDetonates,
    molotovExpires,
    roundStarts,
    roundFreezeEnds,
    roundEnds,
    roundMvps,
    freezeTicks,
    motionTicks,
    grenadeTrajectories
  };
}

// src/lib/demo/stats.ts
function ensure(map, steamId, name) {
  let acc = map.get(steamId);
  if (!acc) {
    acc = {
      steamId,
      name: name || steamId,
      team: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      headshotKills: 0,
      entries: 0,
      flashAssists: 0,
      enemiesFlashed: 0,
      utilityDamage: 0,
      firstDeaths: 0,
      tradedDeaths: 0,
      missedTrades: 0
    };
    map.set(steamId, acc);
  } else if (name && (!acc.name || acc.name === acc.steamId)) {
    acc.name = name;
  }
  return acc;
}
function isRealKill(row) {
  const attacker = steamIdOf(row, "attacker");
  const victim = steamIdOf(row, "user");
  if (!attacker || !victim || attacker === victim) return false;
  return true;
}
function computePlayerStats(demo, rounds) {
  const byId = /* @__PURE__ */ new Map();
  for (const p of demo.playerInfo) {
    const sid = normalizeSteamId(p.steamid);
    if (!sid || sid === "0") continue;
    const acc = ensure(byId, sid, p.name ?? "");
    if (typeof p.team_number === "number") acc.team = p.team_number;
  }
  const firstKillRound = /* @__PURE__ */ new Set();
  const firstDeathRound = /* @__PURE__ */ new Set();
  const deathsSorted = [...demo.deaths].sort(
    (a, b) => tickOf(a) - tickOf(b)
  );
  for (const row of deathsSorted) {
    if (!isRealKill(row)) continue;
    const round = roundOf(row);
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    const attackerName = nameOf(row, "attacker");
    const victimName = nameOf(row, "user");
    const assisterId = steamIdOf(row, "assister");
    const attacker = ensure(byId, attackerId, attackerName);
    attacker.kills += 1;
    if (num(row, "headshot") === 1 || str(row, "headshot") === "true") {
      attacker.headshotKills += 1;
    }
    const victim = ensure(byId, victimId, victimName);
    victim.deaths += 1;
    if (assisterId && assisterId !== attackerId) {
      ensure(byId, assisterId, nameOf(row, "assister")).assists += 1;
    }
    if (!firstKillRound.has(round)) {
      firstKillRound.add(round);
      attacker.entries += 1;
    }
    if (!firstDeathRound.has(round)) {
      firstDeathRound.add(round);
      victim.firstDeaths += 1;
    }
  }
  for (const row of demo.hurts) {
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    if (!attackerId || attackerId === victimId) continue;
    const dmg = num(row, "dmg_health", "dmg_health_real");
    if (dmg <= 0) continue;
    const acc = ensure(byId, attackerId, nameOf(row, "attacker"));
    acc.damage += dmg;
    const weapon = str(row, "weapon").toLowerCase();
    if (weapon.includes("hegrenade") || weapon.includes("inferno") || weapon.includes("molotov") || weapon.includes("incgrenade")) {
      acc.utilityDamage += dmg;
    }
  }
  for (const row of demo.blinds) {
    const attackerId = steamIdOf(row, "attacker");
    const victimId = steamIdOf(row, "user");
    if (!attackerId || !victimId || attackerId === victimId) continue;
    ensure(byId, attackerId, nameOf(row, "attacker")).enemiesFlashed += 1;
  }
  const roundCount = Math.max(rounds, 1);
  return [...byId.values()].filter((p) => p.kills + p.deaths + p.damage > 0 || p.team > 0).map((p) => ({
    steamId: p.steamId,
    name: p.name,
    team: p.team,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    damage: p.damage,
    adr: Math.round(p.damage / roundCount * 10) / 10,
    hsPercent: p.kills > 0 ? Math.round(p.headshotKills / p.kills * 1e3) / 10 : 0,
    entries: p.entries,
    flashAssists: p.flashAssists,
    enemiesFlashed: p.enemiesFlashed,
    utilityDamage: p.utilityDamage,
    firstDeaths: p.firstDeaths,
    tradedDeaths: p.tradedDeaths,
    missedTrades: p.missedTrades
  })).sort((a, b) => b.kills - a.kills || b.adr - a.adr);
}
function countRounds(demo) {
  if (demo.roundEnds.length > 0) return demo.roundEnds.length;
  if (demo.roundStarts.length > 0) return demo.roundStarts.length;
  const maxRound = demo.deaths.reduce(
    (max, row) => Math.max(max, roundOf(row)),
    0
  );
  return maxRound;
}

// src/lib/demo/utility.ts
function analyzeUtility(demo) {
  const mistakes = [];
  const blindsByRound = /* @__PURE__ */ new Map();
  for (const blind of demo.blinds) {
    const round = roundOf(blind);
    const list = blindsByRound.get(round) ?? [];
    list.push(blind);
    blindsByRound.set(round, list);
  }
  for (const flash of demo.flashDetonates) {
    const throwerId = steamIdOf(flash, "thrower") || steamIdOf(flash, "user");
    if (!throwerId) continue;
    const throwerName = nameOf(flash, "thrower") || nameOf(flash, "user") || throwerId;
    const round = roundOf(flash);
    const flashTick = tickOf(flash);
    const blinds = blindsByRound.get(round) ?? [];
    const enemyBlind = blinds.some((b) => {
      const attackerId = steamIdOf(b, "attacker");
      const victimId = steamIdOf(b, "user");
      if (attackerId !== throwerId) return false;
      if (!victimId || victimId === throwerId) return false;
      const bt = tickOf(b);
      return Math.abs(bt - flashTick) <= 128;
    });
    if (!enemyBlind) {
      mistakes.push({
        steamId: throwerId,
        playerName: throwerName,
        round,
        type: "utility",
        message: "Flashbang with no enemy flashed",
        severity: "info"
      });
    }
  }
  const heDamageByRoundPlayer = /* @__PURE__ */ new Map();
  for (const hurt of demo.hurts) {
    const weapon = str(hurt, "weapon").toLowerCase();
    if (!weapon.includes("hegrenade")) continue;
    const attackerId = steamIdOf(hurt, "attacker");
    if (!attackerId) continue;
    const key = `${roundOf(hurt)}|${attackerId}`;
    heDamageByRoundPlayer.set(
      key,
      (heDamageByRoundPlayer.get(key) ?? 0) + num(hurt, "dmg_health", "dmg_health_real")
    );
  }
  for (const he of demo.heDetonates) {
    const throwerId = steamIdOf(he, "thrower") || steamIdOf(he, "user");
    if (!throwerId) continue;
    const throwerName = nameOf(he, "thrower") || nameOf(he, "user") || throwerId;
    const round = roundOf(he);
    const dmg = heDamageByRoundPlayer.get(`${round}|${throwerId}`) ?? 0;
    if (dmg <= 0) {
      mistakes.push({
        steamId: throwerId,
        playerName: throwerName,
        round,
        type: "utility",
        message: "HE grenade dealt 0 damage",
        severity: "info"
      });
    }
  }
  return mistakes;
}

// src/lib/maps.ts
var MAP_CODES = {
  dust2: "de_dust2",
  "dust 2": "de_dust2",
  dustii: "de_dust2",
  mirage: "de_mirage",
  inferno: "de_inferno",
  nuke: "de_nuke",
  overpass: "de_overpass",
  vertigo: "de_vertigo",
  ancient: "de_ancient",
  anubis: "de_anubis",
  train: "de_train",
  cache: "de_cache",
  cobble: "de_cbble",
  cobblestone: "de_cbble",
  cbble: "de_cbble",
  italy: "cs_italy",
  office: "cs_office",
  agency: "cs_agency",
  assault: "cs_assault",
  militia: "cs_militia",
  alpine: "cs_alpine",
  shelter: "cs_shelter",
  jura: "de_jura",
  basalt: "de_basalt",
  edin: "de_edin",
  palacio: "de_palacio",
  thera: "de_thera",
  mills: "de_mills",
  brewery: "de_brewery",
  dogtown: "de_dogtown",
  grail: "de_grail",
  blackgold: "de_blackgold"
};
function normalizeKey(raw) {
  return raw.trim().toLowerCase().replace(/\.bsp$/i, "").replace(/\.vpk$/i, "").replace(/\\/g, "/").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
function extractValveCode(raw) {
  const m = raw.toLowerCase().replace(/\\/g, "/").match(/\b((?:de|cs|ar|gd)_[a-z0-9]+)\b/);
  return m?.[1] ?? null;
}
function mapCode(name) {
  if (!name) return null;
  const extracted = extractValveCode(name);
  if (extracted) return extracted;
  const key = normalizeKey(name);
  if (!key || key === "unknown" || key === "unknown map") return null;
  const compact = key.replace(/\s+/g, "");
  if (MAP_CODES[key]) return MAP_CODES[key];
  if (MAP_CODES[compact]) return MAP_CODES[compact];
  const underscored = key.replace(/\s+/g, "_");
  if (/^(de|cs|ar|gd)_/.test(underscored)) return underscored;
  if (/^(de|cs|ar|gd)_/.test(compact)) return compact;
  if (MAP_CODES[compact.replace(/^(de|cs)/, "")]) {
    return MAP_CODES[compact.replace(/^(de|cs)/, "")];
  }
  if (MAP_CODES[key] || MAP_CODES[compact]) {
    return MAP_CODES[key] ?? MAP_CODES[compact];
  }
  return `de_${compact}`;
}

// src/lib/demo/analyze.ts
function mapNameFromHeader(header) {
  const candidates = [
    header.map_name,
    header.mapname,
    header.map,
    header.MapName,
    header.add_ons,
    header.server_name
  ];
  for (const raw of candidates) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const cleaned = raw.trim().replace(/\\/g, "/").split("/").pop() ?? raw;
    const noExt = cleaned.replace(/\.bsp$/i, "");
    const code = noExt.match(/\b((?:de|cs|ar|gd)_[a-z0-9]+)\b/i);
    if (code?.[1]) return code[1].toLowerCase();
    if (noExt) return noExt;
  }
  for (const value of Object.values(header)) {
    if (typeof value !== "string") continue;
    const code = value.match(/\b((?:de|cs|ar|gd)_[a-z0-9]+)\b/i);
    if (code?.[1]) return code[1].toLowerCase();
  }
  return "unknown";
}
function tickRateFromHeader(header) {
  const raw = header.tickrate ?? header.tick_rate ?? null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n) && n > 0 && n < 1e3) return Math.round(n);
  return 64;
}
function buildSummary(mistakes, cheatScores) {
  const economyMistakes = mistakes.filter((m) => m.type === "economy").length;
  const openingMistakes = mistakes.filter((m) => m.type === "opening").length;
  const tradeMistakes = mistakes.filter((m) => m.type === "trade").length;
  const utilityMistakes = mistakes.filter((m) => m.type === "utility").length;
  const cheatSignals = mistakes.filter((m) => m.type === "cheat").length;
  const countByPlayer = /* @__PURE__ */ new Map();
  for (const m of mistakes) {
    const cur = countByPlayer.get(m.steamId) ?? {
      name: m.playerName,
      n: 0
    };
    cur.n += 1;
    countByPlayer.set(m.steamId, cur);
  }
  let topMistakePlayer = null;
  let topN = 0;
  for (const { name, n } of countByPlayer.values()) {
    if (n > topN) {
      topN = n;
      topMistakePlayer = name;
    }
  }
  const topCheat = cheatScores.find((c) => c.cheatRisk > 0) ?? null;
  return {
    totalMistakes: mistakes.length,
    economyMistakes,
    openingMistakes,
    tradeMistakes,
    utilityMistakes,
    cheatSignals,
    topMistakePlayer,
    highestCheatRiskPlayer: topCheat?.name ?? null
  };
}
function analyzeDemo(path, onProgress) {
  const report = onProgress ?? (() => {
  });
  const parseProgress = (detail, pct) => {
    report("parsing", detail, pct);
  };
  const demo = parseDemoFile(path, parseProgress);
  const rounds = countRounds(demo);
  const tickRate = tickRateFromHeader(demo.header);
  const rawMapName = mapNameFromHeader(demo.header);
  const mapName = mapCode(rawMapName) ?? rawMapName;
  report("analyzing", "Computing player stats\u2026", 76);
  let players = computePlayerStats(demo, rounds);
  report("analyzing", "Checking economy\u2026", 78);
  const economyMistakes = analyzeEconomy(demo);
  report("analyzing", "Checking openings & trades\u2026", 82);
  const { mistakes: openingMistakes, players: withTrades } = analyzeOpeningAndTrades(demo, players, tickRate);
  players = withTrades;
  report("analyzing", "Checking utility\u2026", 85);
  const utilityMistakes = analyzeUtility(demo);
  report("analyzing", "Running cheat heuristics\u2026", 88);
  const { mistakes: cheatMistakes, cheatScores } = analyzeCheating(
    demo,
    players,
    tickRate
  );
  const mistakes = [
    ...cheatMistakes,
    ...economyMistakes,
    ...openingMistakes,
    ...utilityMistakes
  ].sort((a, b) => a.round - b.round || a.type.localeCompare(b.type));
  const match = {
    mapName,
    tickRate,
    durationTicks: typeof demo.header.playback_ticks === "number" ? demo.header.playback_ticks : null,
    rounds,
    scoreCt: null,
    scoreT: null
  };
  report("replay", "Building radar replay\u2026", 92);
  const replay = buildReplay(demo, players, mapName, tickRate);
  report("replay", "Almost done\u2026", 98);
  return {
    match,
    players,
    cheatScores,
    mistakes,
    summary: buildSummary(mistakes, cheatScores),
    replay
  };
}

// src/lib/demo/decompress.ts
var import_node_stream = require("node:stream");
var import_promises = require("node:stream/promises");
var import_node_fs = require("node:fs");
var import_unbzip2_stream = __toESM(require_unbzip2_stream());
function isBzip2DemoName(filename) {
  const name = filename.toLowerCase();
  return name.endsWith(".dem.bz2") || name.endsWith(".bz2");
}
function looksLikeBzip2(buffer) {
  return buffer.length >= 2 && buffer[0] === 66 && buffer[1] === 90;
}
async function writeDemoTempFile(buffer, destPath, originalName) {
  const shouldDecompress = isBzip2DemoName(originalName) || looksLikeBzip2(buffer);
  if (!shouldDecompress) {
    const { writeFile: writeFile3 } = await import("node:fs/promises");
    await writeFile3(destPath, buffer);
    return;
  }
  try {
    await (0, import_promises.pipeline)(
      import_node_stream.Readable.from(buffer),
      (0, import_unbzip2_stream.default)(),
      (0, import_node_fs.createWriteStream)(destPath)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to decompress .bz2 demo: ${message}`);
  }
}

// src/lib/demo/analyzeJob.ts
var import_server_only = __toESM(require_server_only());
var import_node_fs2 = require("node:fs");
var import_promises2 = require("node:fs/promises");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var JOB_TTL_MS = 60 * 60 * 1e3;
function jobsRoot() {
  return (0, import_node_path.join)((0, import_node_os.tmpdir)(), "cscanner-jobs");
}
function jobDir(jobId) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(jobId)) {
    throw new Error("Invalid job id.");
  }
  return (0, import_node_path.join)(jobsRoot(), jobId);
}
function statusPath(jobId) {
  return (0, import_node_path.join)(jobDir(jobId), "status.json");
}
function resultPath(jobId) {
  return (0, import_node_path.join)(jobDir(jobId), "result.json");
}
function updateAnalyzeJob(jobId, patch) {
  let current = null;
  try {
    current = JSON.parse(
      (0, import_node_fs2.readFileSync)(statusPath(jobId), "utf8")
    );
  } catch {
    return;
  }
  const next = {
    ...current,
    ...patch,
    // Never let pct go backwards unless finishing/erroring.
    pct: patch.pct != null && patch.pct < current.pct && !patch.done ? current.pct : patch.pct ?? current.pct,
    updatedAt: Date.now()
  };
  (0, import_node_fs2.writeFileSync)(statusPath(jobId), JSON.stringify(next));
}
async function writeAnalyzeJobResult(jobId, result) {
  await (0, import_promises2.writeFile)(resultPath(jobId), JSON.stringify(result));
}

// src/lib/demo/uploadSession.ts
var import_server_only2 = __toESM(require_server_only());
var import_node_fs3 = require("node:fs");
var import_promises3 = require("node:fs/promises");
var import_node_os2 = require("node:os");
var import_node_path2 = require("node:path");

// src/lib/demo/uploadLimits.ts
var MAX_DEMO_BYTES = 500 * 1024 * 1024;
function resolveChunkBytes() {
  const raw = process.env.NEXT_PUBLIC_UPLOAD_CHUNK_KB;
  const kb = raw != null && raw !== "" ? Number(raw) : 512;
  if (!Number.isFinite(kb) || kb < 64 || kb > 32 * 1024) {
    return 512 * 1024;
  }
  return Math.floor(kb) * 1024;
}
var CHUNK_BYTES = resolveChunkBytes();
var SINGLE_MAX_BYTES = 750 * 1024;

// src/lib/demo/uploadSession.ts
function uploadSessionDir(uploadId) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(uploadId)) {
    throw new Error("Invalid upload id.");
  }
  return (0, import_node_path2.join)((0, import_node_os2.tmpdir)(), "cscanner-uploads", uploadId);
}
async function assembleUploadChunksToFile(uploadId, totalChunks, destPath) {
  if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > 2e5) {
    throw new Error("Invalid chunk count.");
  }
  const dir = uploadSessionDir(uploadId);
  const out = (0, import_node_fs3.createWriteStream)(destPath);
  let total = 0;
  try {
    for (let i = 0; i < totalChunks; i++) {
      const buf = await (0, import_promises3.readFile)((0, import_node_path2.join)(dir, `${i}.part`));
      total += buf.length;
      if (total > MAX_DEMO_BYTES) {
        throw new Error("Demo file is too large (max 500 MB).");
      }
      const ok = out.write(buf);
      if (!ok) {
        await new Promise((resolve) => out.once("drain", resolve));
      }
    }
    await new Promise((resolve, reject) => {
      out.end(() => resolve());
      out.on("error", reject);
    });
  } catch (err) {
    out.destroy();
    throw err;
  }
  return total;
}
async function assembleUploadChunks(uploadId, totalChunks) {
  if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > 2e5) {
    throw new Error("Invalid chunk count.");
  }
  const dir = uploadSessionDir(uploadId);
  const parts = [];
  let total = 0;
  for (let i = 0; i < totalChunks; i++) {
    const buf = await (0, import_promises3.readFile)((0, import_node_path2.join)(dir, `${i}.part`));
    total += buf.length;
    if (total > MAX_DEMO_BYTES) {
      throw new Error("Demo file is too large (max 500 MB).");
    }
    parts.push(buf);
  }
  return Buffer.concat(parts, total);
}
async function cleanupUploadSession(uploadId) {
  try {
    await (0, import_promises3.rm)(uploadSessionDir(uploadId), { recursive: true, force: true });
  } catch {
  }
}

// src/lib/demo/runAnalyzeUploadJob.ts
function assertDemoparserLoaded() {
  try {
    require("@laihoe/demoparser2");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Demo parser native module failed to load on this server (${detail}). Rebuild the Docker image with Alpine/musl demoparser bindings.`
    );
  }
}
async function runAnalyzeUploadJob(opts) {
  const { jobId, fileName, totalChunks } = opts;
  let uploadId = opts.uploadId;
  let tempPath = null;
  const started = Date.now();
  try {
    assertDemoparserLoaded();
    updateAnalyzeJob(jobId, {
      stage: "assembling",
      detail: `Assembling ${totalChunks} chunks\u2026`,
      pct: 2
    });
    tempPath = (0, import_node_path3.join)((0, import_node_os3.tmpdir)(), `cscanner-demo-${(0, import_node_crypto.randomUUID)()}.dem`);
    if (isBzip2DemoName(fileName)) {
      const buffer = await assembleUploadChunks(uploadId, totalChunks);
      updateAnalyzeJob(jobId, {
        stage: "decompressing",
        detail: `Decompressing ${(buffer.length / 1024 / 1024).toFixed(0)} MB\u2026`,
        pct: 8
      });
      console.info(
        `[analyze-job ${jobId}] assembled ${(buffer.length / 1024 / 1024).toFixed(1)} MB, decompressing\u2026 (+${Date.now() - started}ms)`
      );
      await writeDemoTempFile(buffer, tempPath, fileName);
      updateAnalyzeJob(jobId, {
        stage: "parsing",
        detail: "Decompressed \u2014 starting parse\u2026",
        pct: 14
      });
    } else {
      const bytes = await assembleUploadChunksToFile(
        uploadId,
        totalChunks,
        tempPath
      );
      console.info(
        `[analyze-job ${jobId}] assembled ${(bytes / 1024 / 1024).toFixed(1)} MB\u2026 (+${Date.now() - started}ms)`
      );
      updateAnalyzeJob(jobId, {
        stage: "parsing",
        detail: "Assembled \u2014 starting parse\u2026",
        pct: 12
      });
    }
    await cleanupUploadSession(uploadId);
    uploadId = "";
    console.info(
      `[analyze-job ${jobId}] analyzing\u2026 (+${Date.now() - started}ms)`
    );
    const analysis = analyzeDemo(tempPath, (stage, detail, pct) => {
      updateAnalyzeJob(jobId, { stage, detail, pct });
    });
    await writeAnalyzeJobResult(jobId, analysis);
    updateAnalyzeJob(jobId, {
      stage: "done",
      detail: `Done \u2014 ${analysis.match.mapName}`,
      pct: 100,
      done: true
    });
    console.info(
      `[analyze-job ${jobId}] done in ${Date.now() - started}ms (map=${analysis.match.mapName})`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse demo.";
    console.error(`[analyze-job ${jobId}]`, err);
    updateAnalyzeJob(jobId, {
      stage: "error",
      detail: message,
      pct: 0,
      done: true,
      error: message
    });
  } finally {
    if (uploadId) await cleanupUploadSession(uploadId);
    if (tempPath) {
      try {
        await (0, import_promises4.unlink)(tempPath);
      } catch {
      }
    }
  }
}

// src/lib/demo/workerEntry.ts
async function main() {
  const [jobId, uploadId, fileName, totalChunksStr] = process.argv.slice(2);
  if (!jobId || !uploadId || !fileName || !totalChunksStr) {
    console.error(
      "Usage: analyze-worker <jobId> <uploadId> <fileName> <totalChunks>"
    );
    process.exit(2);
  }
  const totalChunks = Number(totalChunksStr);
  if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
    console.error("Invalid totalChunks");
    process.exit(2);
  }
  console.info(
    `[analyze-worker] start job=${jobId} upload=${uploadId} file=${fileName} chunks=${totalChunks}`
  );
  await runAnalyzeUploadJob({
    jobId,
    uploadId,
    fileName,
    totalChunks
  });
}
main().then(() => {
  console.info("[analyze-worker] exit 0");
  process.exit(0);
}).catch((err) => {
  console.error("[analyze-worker] fatal", err);
  process.exit(1);
});
