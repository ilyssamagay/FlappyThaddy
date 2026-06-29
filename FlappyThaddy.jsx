import { useState, useEffect, useRef, useCallback } from "react";
import thaddyImg from "./thaddy.png";

const W = 400, H = 580;
const BIRD_X = 80;
const GRAVITY = 0.45;
const JUMP = -9;
const PIPE_W = 58;
const PIPE_GAP = 160;
const PIPE_SPEED = 2.8;
const SPAWN_INTERVAL = 110;
const BOOK_COLORS = ["#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6","#e67e22","#1abc9c","#e91e63"];
const MEDALS = ["🥇","🥈","🥉"];

const appStorage = {
  async get(key) {
    if (typeof window !== "undefined" && window.storage?.get) {
      try { return await window.storage.get(key); } catch {}
    }
    try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; }
  },
  async set(key, val) {
    if (typeof window !== "undefined" && window.storage?.set) {
      try { await window.storage.set(key, val); return; } catch {}
    }
    try { localStorage.setItem(key, val); } catch {}
  },
  async remove(key) {
    if (typeof window !== "undefined" && window.storage?.delete) {
      try { await window.storage.delete(key); return; } catch {}
    }
    try { localStorage.removeItem(key); } catch {}
  }
};

export default function FlappyPencil() {
  const canvasRef = useRef(null);
  const birdImgRef = useRef(null);
  const gsRef = useRef({ phase: "idle", y: H / 2, vy: 0, pipes: [], score: 0, frame: 0, raf: null });
  const loopRef = useRef(null);
  const [phase, setPhase] = useState("idle");
  const [liveScore, setLiveScore] = useState(0);
  const [board, setBoard] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [inputName, setInputName] = useState("");
  const [deadScore, setDeadScore] = useState(0);

  useEffect(() => {
    (async () => {
      const r = await appStorage.get("flappy-pencil-lb");
      if (r?.value) { try { setBoard(JSON.parse(r.value)); } catch {} }
    })();
  }, []);

  function drawBookStack(ctx, x, y, height, isTop) {
    if (height <= 2) return;
    const BH = 32;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, PIPE_W, height); ctx.clip();
    let cy = y, i = 0;
    while (cy < y + height) {
      ctx.fillStyle = BOOK_COLORS[i % BOOK_COLORS.length];
      ctx.fillRect(x, cy, PIPE_W, BH);
      ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(x, cy, 7, BH);
      ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(x + 10, cy + 10, PIPE_W - 16, 3);
      cy += BH; i++;
    }
    ctx.restore();
    ctx.fillStyle = "#4e342e";
    if (isTop) ctx.fillRect(x - 5, y + height - 9, PIPE_W + 10, 9);
    else ctx.fillRect(x - 5, y, PIPE_W + 10, 9);
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const gs = gsRef.current;

    ctx.fillStyle = "#e8f4fe";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(66,133,244,0.1)";
    ctx.lineWidth = 1;
    for (let y = 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(234,67,53,0.15)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(48, 0); ctx.lineTo(48, H - 34); ctx.stroke();

    gs.pipes.forEach(p => {
      drawBookStack(ctx, p.x, 0, p.top, true);
      drawBookStack(ctx, p.x, p.top + PIPE_GAP, H - p.top - PIPE_GAP - 34, false);
    });

    ctx.fillStyle = "#795548"; ctx.fillRect(0, H - 34, W, 34);
    ctx.fillStyle = "#6d4c41";
    for (let x = 0; x < W; x += 48) ctx.fillRect(x, H - 34, 24, 5);

    ctx.save();
    const angle = Math.min(Math.max(gs.vy * 2.8, -50), 70) * Math.PI / 180;
    ctx.translate(BIRD_X, gs.y);
    ctx.rotate(angle);
    const birdImg = birdImgRef.current;
    if (birdImg?.complete && birdImg.naturalWidth > 0) {
      const maxSize = 80;
      const scale = Math.min(maxSize / birdImg.naturalWidth, maxSize / birdImg.naturalHeight);
      const birdW = birdImg.naturalWidth * scale;
      const birdH = birdImg.naturalHeight * scale;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(birdImg, -birdW / 2, -birdH / 2, birdW, birdH);
    } else {
      ctx.fillStyle = "#ffb3c1"; ctx.fillRect(-36, -7, 9, 14);
      ctx.fillStyle = "#aaa"; ctx.fillRect(-28, -7, 7, 14);
      ctx.fillStyle = "#fdd835"; ctx.fillRect(-22, -8, 44, 16);
      ctx.fillStyle = "#f9a825"; ctx.fillRect(-22, -8, 6, 16);
      ctx.fillStyle = "#d4916a";
      ctx.beginPath(); ctx.moveTo(22, -8); ctx.lineTo(34, 0); ctx.lineTo(22, 8); ctx.fill();
      ctx.fillStyle = "#444";
      ctx.beginPath(); ctx.moveTo(31, -2.5); ctx.lineTo(38, 0); ctx.lineTo(31, 2.5); ctx.fill();
    }
    ctx.restore();

    if (gs.phase !== "idle") {
      ctx.font = "bold 36px Arial"; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillText(gs.score, W / 2 + 2, 55);
      ctx.fillStyle = "#fff"; ctx.fillText(gs.score, W / 2, 53);
    }

    if (gs.phase === "idle") {
    }

    if (gs.phase === "dead") {
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(0, 0, W, H);
    }
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      birdImgRef.current = img;
      draw();
    };
    img.src = thaddyImg;
  }, [draw]);

  loopRef.current = () => {
    const gs = gsRef.current;
    if (gs.phase !== "playing") return;
    gs.frame++;
    gs.vy += GRAVITY;
    gs.y += gs.vy;

    if (gs.frame % SPAWN_INTERVAL === 0) {
      const minH = 55, maxH = H - PIPE_GAP - 34 - minH;
      gs.pipes.push({ x: W + 10, top: Math.floor(Math.random() * (maxH - minH) + minH), passed: false });
    }

    gs.pipes.forEach(p => {
      p.x -= PIPE_SPEED;
      if (!p.passed && p.x + PIPE_W < BIRD_X) {
        p.passed = true; gs.score++;
        setLiveScore(gs.score);
      }
    });
    gs.pipes = gs.pipes.filter(p => p.x + PIPE_W > 0);

    const hit =
      gs.y < 8 || gs.y > H - 34 - 8 ||
      gs.pipes.some(p =>
        BIRD_X + 28 > p.x && BIRD_X - 14 < p.x + PIPE_W &&
        (gs.y - 7 < p.top || gs.y + 7 > p.top + PIPE_GAP)
      );

    if (hit) {
      gs.phase = "dead";
      setPhase("dead");
      setDeadScore(gs.score);
      setShowInput(true);
      draw(); return;
    }

    draw();
    gs.raf = requestAnimationFrame(() => loopRef.current?.());
  };

  const startGame = useCallback(() => {
    const gs = gsRef.current;
    cancelAnimationFrame(gs.raf);
    Object.assign(gs, { phase: "playing", y: H / 2, vy: 0, pipes: [], score: 0, frame: 0 });
    setPhase("playing"); setLiveScore(0); setShowInput(false);
    gs.raf = requestAnimationFrame(() => loopRef.current?.());
  }, []);

  const flap = useCallback(() => {
    const gs = gsRef.current;
    if (gs.phase === "idle" || gs.phase === "dead") {
      startGame();
      return;
    }

    if (gs.phase === "playing") {
      gs.vy = JUMP;
      draw();
    }
  }, [startGame]);

  useEffect(() => {
    const gs = gsRef.current;
    let t = 0;
    const idle = () => {
      if (gs.phase !== "idle") return;
      gs.y = H / 2 + Math.sin(t * 0.04) * 14;
      gs.vy = Math.cos(t * 0.04) * 1.8;
      t++; draw();
      gs.raf = requestAnimationFrame(idle);
    };
    gs.raf = requestAnimationFrame(idle);
    return () => cancelAnimationFrame(gs.raf);
  }, [draw]);

  useEffect(() => {
    const fn = e => {
      if (e.code === "Space" || e.key === "ArrowUp") { e.preventDefault(); flap(); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [flap]);

  const submitScore = async () => {
    const n = inputName.trim();
    if (!n) return;
    const updated = [...board, { name: n, score: deadScore }]
      .sort((a, b) => b.score - a.score).slice(0, 10);
    setBoard(updated);
    setShowInput(false);
    setInputName("");
    await appStorage.set("flappy-pencil-lb", JSON.stringify(updated));
  };

  const clearBoard = async () => {
    setBoard([]);
    await appStorage.remove("flappy-pencil-lb");
  };

  const retryGame = useCallback(() => {
    setInputName("");
    startGame();
  }, [startGame]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "#f0f4ff", padding: "20px 12px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#1a237e", margin: "0 0 2px", fontSize: "22px", letterSpacing: "-0.5px" }}>Flappy T.Dy</h1>
      <p style={{ color: "#7986cb", margin: "0 0 14px", fontSize: "12px" }}>Highest score gets incentives ah!</p>

      <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={e => {
            e.preventDefault();
            flap();
          }}
          style={{ display: "block", cursor: "pointer", touchAction: "none" }}
        />

        {phase === "idle" && !showInput && (
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 10, width: "290px", pointerEvents: "none" }}>
            <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: "18px", padding: "24px 20px 18px", textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
              <div style={{ color: "#1a237e", fontSize: "28px", fontWeight: "bold", letterSpacing: "-0.5px", marginBottom: "8px" }}>T.Dy's Classroom</div>
              <div style={{ color: "#555", fontSize: "15px", marginBottom: "6px" }}>Tap • Click • Spacebar to fly!</div>
              <div style={{ color: "#888", fontSize: "13px", lineHeight: 1.35, marginBottom: "6px" }}>Dodge the colorful book stacks 📚</div>
              <div style={{ color: "#888", fontSize: "13px", lineHeight: 1.35, marginBottom: "14px" }}>Beat your classmates on the leaderboard!</div>
              <div style={{ color: "#b39ddb", fontSize: "12px", fontWeight: "bold", marginBottom: "14px" }}>↑ or Space also works</div>
              <button
                onPointerDown={e => {
                  e.preventDefault();
                  startGame();
                }}
                style={{
                  pointerEvents: "auto",
                  padding: "12px 22px",
                  border: "none",
                  borderRadius: "999px",
                  background: "#3f51b5",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: "bold",
                  boxShadow: "0 12px 30px rgba(63,81,181,0.35)",
                  cursor: "pointer"
                }}
              >
                Play
              </button>
            </div>
          </div>
        )}

        {showInput && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, background: "rgba(0,0,0,0.08)" }}>
            <div style={{ background: "white", borderRadius: "18px", padding: "24px 20px", textAlign: "center", width: "220px", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
              <div style={{ fontSize: "36px", marginBottom: "2px" }}>🏆</div>
              <div style={{ fontWeight: "bold", fontSize: "22px", color: "#1a237e" }}>Score: {deadScore}</div>
              <div style={{ color: "#888", fontSize: "12px", margin: "6px 0 12px" }}>Enter your name for the leaderboard!</div>
              <input
                autoFocus type="text" placeholder="Your name..." maxLength={20}
                value={inputName}
                onChange={e => setInputName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitScore(); }}
                style={{ width: "100%", padding: "9px 10px", borderRadius: "10px", fontSize: "14px", border: "2px solid #3f51b5", outline: "none", boxSizing: "border-box", marginBottom: "10px" }}
              />
              <button onClick={submitScore} style={{ width: "100%", padding: "10px", background: "#3f51b5", color: "white", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "14px", marginBottom: "7px" }}>
                Save Score
              </button>
              <button onPointerDown={e => { e.preventDefault(); retryGame(); }} style={{ width: "100%", padding: "10px", background: "#e8eaf6", color: "#1a237e", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "14px", marginBottom: "7px" }}>
                Retry
              </button>
              <button onClick={() => setShowInput(false)} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: "12px" }}>
                Skip
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: "20px", background: "white", borderRadius: "14px", padding: "18px 16px", width: "100%", maxWidth: "400px", boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        <h2 style={{ margin: "0 0 14px", color: "#1a237e", fontSize: "16px", textAlign: "center" }}>🏆 Class Leaderboard</h2>
        {board.length === 0
          ? <p style={{ textAlign: "center", color: "#ccc", fontSize: "13px", margin: 0 }}>No scores yet!</p>
          : board.map((e, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", padding: "9px 12px", marginBottom: "5px",
              borderRadius: "9px",
              background: i === 0 ? "#fffde7" : i === 1 ? "#fafafa" : i === 2 ? "#fff5f0" : "#fafafa",
              border: `1px solid ${i < 3 ? "#fdd835" : "#eee"}`
            }}>
              <span style={{ fontSize: "18px", width: "28px", textAlign: "center" }}>{MEDALS[i] || `${i + 1}`}</span>
              <span style={{ flex: 1, marginLeft: "8px", fontWeight: i < 3 ? "bold" : "normal", color: "#1a237e" }}>{e.name}</span>
              <span style={{ fontWeight: "bold", color: "#e53935", fontSize: "16px" }}>{e.score}</span>
            </div>
          ))
        }
        {board.length > 0 && (
          <button onClick={clearBoard} style={{ marginTop: "10px", width: "100%", padding: "7px", background: "none", color: "#ddd", border: "1px solid #eee", borderRadius: "8px", cursor: "pointer", fontSize: "11px" }}>
            🗑 Clear leaderboard
          </button>
        )}
      </div>

      <p style={{ color: "#b0bec5", fontSize: "11px", marginTop: "10px", textAlign: "center" }}>
        Tap the game • Click • Space / ↑ to flap
      </p>
    </div>
  );
}
