import { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, ChevronRight, Gamepad2, Volume2, Award, Clock, Flame, Percent, AlertCircle, Zap } from 'lucide-react';

// --- 音響効果（Web Audio API） ---
const playSynthSound = (type: 'success' | 'clear' | 'failed') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (type === 'success') {
      // ピポッという小気味良い高めの音
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'clear') {
      // 明るい上昇アルペジオ
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.25);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });
    } else if (type === 'failed') {
      // 低く下降するゲームオーバー音
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(220, now);
      osc1.frequency.linearRampToValueAtTime(55, now + 0.6);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(223, now);
      osc2.frequency.linearRampToValueAtTime(56, now + 0.6);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start(now);
      osc1.stop(now + 0.6);
      osc2.start(now);
      osc2.stop(now + 0.6);
    }
  } catch (e) {
    console.error('Failed to play synthesized sound:', e);
  }
};

// --- キー定義 ---
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBERS = '0123456789'.split('');
const SYMBOLS = ['-', '[', ']', ';', ':', ',', '.', '/'];

// ランダムにターゲット文字/指示を取得
const getRandomIndicator = (): string => {
  const pool = [...ALPHABET, ...NUMBERS, ...SYMBOLS];
  return pool[Math.floor(Math.random() * pool.length)];
};

// --- ステージ定義 ---
interface StageConfig {
  id: number;
  name: string;
  totalEnemies: number;
  duration: number; // 60
  baseEnemySize: number;
  phases: {
    timeTrigger: number; // 残り時間秒
    count: number;
    patterns: ('static' | 'horizontal' | 'vertical' | 'free')[];
    speedTypes: ('constant' | 'variable')[];
  }[];
}

const STAGES: StageConfig[] = [
  {
    id: 1,
    name: 'ステージ 1 (初級)',
    totalEnemies: 6,
    duration: 60,
    baseEnemySize: 120,
    phases: [
      {
        timeTrigger: 60,
        count: 3,
        patterns: ['static', 'horizontal', 'vertical'],
        speedTypes: ['constant', 'constant', 'constant']
      },
      {
        timeTrigger: 45,
        count: 3,
        patterns: ['horizontal', 'vertical', 'static'],
        speedTypes: ['constant', 'constant', 'constant']
      }
    ]
  },
  {
    id: 2,
    name: 'ステージ 2 (中級 - 基本)',
    totalEnemies: 8,
    duration: 60,
    baseEnemySize: 110,
    phases: [
      {
        timeTrigger: 60,
        count: 4,
        patterns: ['static', 'horizontal', 'vertical', 'free'],
        speedTypes: ['constant', 'constant', 'constant', 'constant']
      },
      {
        timeTrigger: 50,
        count: 2,
        patterns: ['horizontal', 'free'],
        speedTypes: ['constant', 'constant']
      },
      {
        timeTrigger: 30,
        count: 2,
        patterns: ['vertical', 'static'],
        speedTypes: ['constant', 'constant']
      }
    ]
  },
  {
    id: 3,
    name: 'ステージ 3 (中級 - 応用)',
    totalEnemies: 10,
    duration: 60,
    baseEnemySize: 100,
    phases: [
      {
        timeTrigger: 60,
        count: 4,
        patterns: ['static', 'horizontal', 'vertical', 'free'],
        speedTypes: ['constant', 'variable', 'constant', 'variable']
      },
      {
        timeTrigger: 45,
        count: 3,
        patterns: ['horizontal', 'vertical', 'free'],
        speedTypes: ['variable', 'constant', 'variable']
      },
      {
        timeTrigger: 25,
        count: 3,
        patterns: ['free', 'static', 'free'],
        speedTypes: ['variable', 'constant', 'constant']
      }
    ]
  },
  {
    id: 4,
    name: 'ステージ 4 (上級 - 高速)',
    totalEnemies: 12,
    duration: 60,
    baseEnemySize: 90,
    phases: [
      {
        timeTrigger: 60,
        count: 5,
        patterns: ['horizontal', 'vertical', 'free', 'free', 'static'],
        speedTypes: ['variable', 'variable', 'constant', 'variable', 'constant']
      },
      {
        timeTrigger: 40,
        count: 4,
        patterns: ['horizontal', 'vertical', 'free', 'free'],
        speedTypes: ['variable', 'variable', 'variable', 'variable']
      },
      {
        timeTrigger: 20,
        count: 3,
        patterns: ['free', 'free', 'vertical'],
        speedTypes: ['variable', 'variable', 'variable']
      }
    ]
  },
  {
    id: 5,
    name: 'ステージ 5 (最上級 - カオス)',
    totalEnemies: 14,
    duration: 60,
    baseEnemySize: 80,
    phases: [
      {
        timeTrigger: 60,
        count: 6,
        patterns: ['free', 'free', 'free', 'horizontal', 'vertical', 'static'],
        speedTypes: ['variable', 'variable', 'variable', 'variable', 'variable', 'constant']
      },
      {
        timeTrigger: 45,
        count: 4,
        patterns: ['free', 'free', 'free', 'free'],
        speedTypes: ['variable', 'variable', 'variable', 'variable']
      },
      {
        timeTrigger: 25,
        count: 4,
        patterns: ['free', 'free', 'free', 'free'],
        speedTypes: ['variable', 'variable', 'variable', 'variable']
      }
    ]
  }
];

// --- エネミー型定義 ---
interface Enemy {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  indicator: string; // 表示されるキー/マウスクリック
  pattern: 'static' | 'horizontal' | 'vertical' | 'free';
  speedType: 'constant' | 'variable';
  speedFactorOffset: number; // 速度変化用の初期位相
  zIndex: number;
}

// 効果音ビジュアルフィードバック用通知
interface SENotification {
  id: string;
  text: string;
  type: 'success' | 'clear' | 'failed';
  timestamp: number;
}

// ビジュアルフィードバック用ポップアップ型
interface VisualPopup {
  id: string;
  x: number;
  y: number;
  text: string;
  colorClass: string;
  life: number;
}

// ビジュアルフィードバック用パーティクル型
interface VisualParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
}

export default function App() {
  // 画面状態: 'title' | 'select' | 'game' | 'result'
  const [scene, setScene] = useState<'title' | 'select' | 'game' | 'result'>('title');
  const [selectedStage, setSelectedStage] = useState<StageConfig>(STAGES[0]);

  // ゲーム用ステート
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isGameClear, setIsGameClear] = useState<boolean>(false);
  
  // スポーン管理
  const [spawnedCount, setSpawnedCount] = useState<number>(0);
  const [phasesTriggered, setPhasesTriggered] = useState<number[]>([]); // 既に発動したフェーズインデックス

  // 統計情報
  const [hitCount, setHitCount] = useState<number>(0);
  const [missCount, setMissCount] = useState<number>(0);
  const [clearTime, setClearTime] = useState<number>(0);

  // コンボシステムステート
  const [currentCombo, setCurrentCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);

  // ビジュアルエフェクトステート
  const [popups, setPopups] = useState<VisualPopup[]>([]);
  const [particles, setParticles] = useState<VisualParticle[]>([]);
  const [isMissFlashing, setIsMissFlashing] = useState<boolean>(false);

  // マウス/カーソル位置 (ゲーム領域の左上を原点 0,0 とした相対ピクセル座標)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMouseInStage, setIsMouseInStage] = useState<boolean>(false);

  // 効果音通知
  const [seNotifications, setSeNotifications] = useState<SENotification[]>([]);

  // 参照
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const physicsRef = useRef<any>(null);
  const zIndexCounter = useRef<number>(1);
  const startTimeRef = useRef<number>(0);

  // ステージ固定ピクセルサイズ
  const containerWidth = 960;
  const containerHeight = 540;

  // --- SE再生 & 視覚通知登録 ---
  const triggerSE = (type: 'success' | 'clear' | 'failed') => {
    playSynthSound(type);
    
    let text = '';
    if (type === 'success') text = '🎵 [SE: Key Success]';
    else if (type === 'clear') text = '🎉 [SE: Stage Clear]';
    else if (type === 'failed') text = '⚠️ [SE: Stage Failed]';

    const newNotification: SENotification = {
      id: Math.random().toString(),
      text,
      type,
      timestamp: Date.now()
    };

    setSeNotifications(prev => [newNotification, ...prev].slice(0, 5));
  };

  // 撃破エフェクトの生成
  const createHitEffects = (x: number, y: number, comboVal: number) => {
    // 弾けるパーティクル生成 (15個程度)
    const newParticles: VisualParticle[] = [];
    const colors = ['#f43f5e', '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#fef08a'];
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 3;
      newParticles.push({
        id: `p-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 1.0
      });
    }

    // ポップアップテキスト生成
    const newPopup: VisualPopup = {
      id: `pop-${Date.now()}-${Math.random()}`,
      x,
      y: y - 10,
      text: comboVal > 1 ? `${comboVal} Combo!` : '+1',
      colorClass: comboVal >= 10 ? 'text-yellow-400 font-extrabold text-xl scale-110 drop-shadow-[0_2px_8px_rgba(234,179,8,0.5)]' : comboVal >= 5 ? 'text-amber-300 font-bold text-lg' : 'text-indigo-300 font-medium text-sm',
      life: 1.0
    };

    setParticles(prev => [...prev, ...newParticles]);
    setPopups(prev => [...prev, newPopup]);
  };

  // ミス時のエフェクト生成
  const createMissEffect = (x: number, y: number) => {
    // 赤フラッシュを発動
    setIsMissFlashing(true);
    setTimeout(() => {
      setIsMissFlashing(false);
    }, 120);

    // ポップアップ「MISS!」
    const newPopup: VisualPopup = {
      id: `pop-miss-${Date.now()}-${Math.random()}`,
      x,
      y: y - 10,
      text: 'MISS!',
      colorClass: 'text-rose-500 font-black tracking-wider text-base drop-shadow-[0_2px_6px_rgba(244,63,94,0.4)] animate-pulse',
      life: 1.0
    };
    setPopups(prev => [...prev, newPopup]);
  };

  // 通知の時間経過消滅
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSeNotifications(prev => prev.filter(n => now - n.timestamp < 1500));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // --- ゲーム初期化・開始 ---
  const startGame = (stage: StageConfig) => {
    setSelectedStage(stage);
    setScene('game');
    setTimeRemaining(stage.duration);
    setIsGameOver(false);
    setIsGameClear(false);
    setHitCount(0);
    setMissCount(0);
    setClearTime(0);
    setSpawnedCount(0);
    setPhasesTriggered([]);
    setEnemies([]);
    setCurrentCombo(0);
    setMaxCombo(0);
    setPopups([]);
    setParticles([]);
    setIsMissFlashing(false);
    zIndexCounter.current = 1;
    startTimeRef.current = Date.now();

    // 最初のスポーン
    triggerSpawnsForTime(stage, stage.duration, 0);
  };

  // 指定時間に合致するフェーズのエネミーをスポーン
  const triggerSpawnsForTime = (stage: StageConfig, timeSec: number, currentSpawned: number) => {
    // timeTrigger に合致、またはそれを下回った未処理のフェーズを検索
    const phaseIndicesToTrigger: number[] = [];
    
    stage.phases.forEach((phase, idx) => {
      if (timeSec <= phase.timeTrigger && !phasesTriggered.includes(idx)) {
        phaseIndicesToTrigger.push(idx);
      }
    });

    if (phaseIndicesToTrigger.length === 0) return;

    let newEnemiesList: Enemy[] = [];
    let extraSpawned = 0;

    phaseIndicesToTrigger.forEach(phaseIdx => {
      const phase = stage.phases[phaseIdx];
      
      for (let i = 0; i < phase.count; i++) {
        // サイズ計算 (各ステージ基準値 ±20% のランダム)
        const baseSize = stage.baseEnemySize;
        const sizeVariance = baseSize * 0.2;
        const size = Math.round(baseSize + (Math.random() * sizeVariance * 2 - sizeVariance));

        // 初期配置 (画面端からエネミーの半径分内側)
        const radius = size / 2;
        const x = Math.random() * (containerWidth - size) + radius;
        const y = Math.random() * (containerHeight - size) + radius;

        // 速度
        const pattern = phase.patterns[i % phase.patterns.length];
        const speedType = phase.speedTypes[i % phase.speedTypes.length];
        
        let vx = 0;
        let vy = 0;
        const baseSpeed = stage.id * 0.7 + 1.0; // ステージが上がると基本速度上昇（少し遅めに調整）

        if (pattern === 'horizontal') {
          vx = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
        } else if (pattern === 'vertical') {
          vy = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
        } else if (pattern === 'free') {
          const angle = Math.random() * Math.PI * 2;
          vx = Math.cos(angle) * baseSpeed;
          vy = Math.sin(angle) * baseSpeed;
        }

        newEnemiesList.push({
          id: `${phaseIdx}-${i}-${Date.now()}-${Math.random()}`,
          x,
          y,
          vx,
          vy,
          size,
          indicator: getRandomIndicator(),
          pattern,
          speedType,
          speedFactorOffset: Math.random() * Math.PI * 2,
          zIndex: zIndexCounter.current++
        });
      }

      extraSpawned += phase.count;
      setPhasesTriggered(prev => [...prev, phaseIdx]);
    });

    if (newEnemiesList.length > 0) {
      setEnemies(prev => [...prev, ...newEnemiesList]);
      setSpawnedCount(currentSpawned + extraSpawned);
    }
  };

  // 次のフェーズのエネミーを時間に関わらず即座にスポーンさせる
  const triggerNextPhase = (stage: StageConfig, currentSpawned: number, currentTriggered: number[]) => {
    // まだトリガーされていない最初のフェーズを見つける
    const nextPhaseIdx = stage.phases.findIndex((_, idx) => !currentTriggered.includes(idx));
    if (nextPhaseIdx === -1) return;

    let newEnemiesList: Enemy[] = [];
    const phase = stage.phases[nextPhaseIdx];
    
    for (let i = 0; i < phase.count; i++) {
      const baseSize = stage.baseEnemySize;
      const sizeVariance = baseSize * 0.2;
      const size = Math.round(baseSize + (Math.random() * sizeVariance * 2 - sizeVariance));

      const radius = size / 2;
      const x = Math.random() * (containerWidth - size) + radius;
      const y = Math.random() * (containerHeight - size) + radius;

      const pattern = phase.patterns[i % phase.patterns.length];
      const speedType = phase.speedTypes[i % phase.speedTypes.length];
      
      let vx = 0;
      let vy = 0;
      const baseSpeed = stage.id * 0.7 + 1.0; // 少し遅めに調整

      if (pattern === 'horizontal') {
        vx = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
      } else if (pattern === 'vertical') {
        vy = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
      } else if (pattern === 'free') {
        const angle = Math.random() * Math.PI * 2;
        vx = Math.cos(angle) * baseSpeed;
        vy = Math.sin(angle) * baseSpeed;
      }

      newEnemiesList.push({
        id: `${nextPhaseIdx}-${i}-${Date.now()}-${Math.random()}`,
        x,
        y,
        vx,
        vy,
        size,
        indicator: getRandomIndicator(),
        pattern,
        speedType,
        speedFactorOffset: Math.random() * Math.PI * 2,
        zIndex: zIndexCounter.current++
      });
    }

    setEnemies(prev => [...prev, ...newEnemiesList]);
    setSpawnedCount(currentSpawned + phase.count);
    setPhasesTriggered(prev => [...prev, nextPhaseIdx]);
  };

  // --- ゲームループ（物理移動・タイマー） ---
  useEffect(() => {
    if (scene !== 'game' || isGameOver || isGameClear) {
      if (physicsRef.current) cancelAnimationFrame(physicsRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // タイマー管理 (残り時間・追加フェーズのトリガー)
    const startTime = Date.now();
    const durationMs = selectedStage.duration * 1000;

    timerRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const remainingSec = Math.max(0, (durationMs - elapsedMs) / 1000);
      setTimeRemaining(remainingSec);

      // 追加スポーン確認
      setSpawnedCount(current => {
        triggerSpawnsForTime(selectedStage, remainingSec, current);
        return current;
      });

      // タイムアップ判定
      if (remainingSec <= 0) {
        clearInterval(timerRef.current);
        handleStageFailed();
      }
    }, 100);

    // 物理移動管理 (requestAnimationFrame)
    let lastTime = Date.now();
    const updatePhysics = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 16.666; // 基準フレームレートからのデルタ
      lastTime = now;

      setEnemies(prevEnemies => {
        return prevEnemies.map(enemy => {
          if (enemy.pattern === 'static') return enemy;

          let vx = enemy.vx;
          let vy = enemy.vy;

          // 変化型速度特性の計算 (正弦波で加減速)
          if (enemy.speedType === 'variable') {
            const timeParam = (now / 1000) * 3 + enemy.speedFactorOffset;
            const speedFactor = 0.3 + 1.4 * Math.abs(Math.sin(timeParam));
            vx = enemy.vx * speedFactor;
            vy = enemy.vy * speedFactor;
          }

          let nextX = enemy.x + vx * dt;
          let nextY = enemy.y + vy * dt;
          let nextVx = enemy.vx;
          let nextVy = enemy.vy;

          const radius = enemy.size / 2;

          // 画面端の跳ね返り
          if (nextX - radius < 0) {
            nextX = radius;
            nextVx = -enemy.vx;
          } else if (nextX + radius > containerWidth) {
            nextX = containerWidth - radius;
            nextVx = -enemy.vx;
          }

          if (nextY - radius < 0) {
            nextY = radius;
            nextVy = -enemy.vy;
          } else if (nextY + radius > containerHeight) {
            nextY = containerHeight - radius;
            nextVy = -enemy.vy;
          }

          return {
            ...enemy,
            x: nextX,
            y: nextY,
            vx: nextVx,
            vy: nextVy
          };
        });
      });

      // ポップアップの更新
      setPopups(prevPopups => {
        return prevPopups
          .map(pop => ({
            ...pop,
            y: pop.y - 1.2 * dt,
            life: pop.life - 0.02 * dt
          }))
          .filter(pop => pop.life > 0);
      });

      // パーティクルの更新
      setParticles(prevParticles => {
        return prevParticles
          .map(p => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            vy: p.vy + 0.1 * dt, // 簡易的な重力
            alpha: Math.max(0, p.life - 0.02 * dt),
            life: p.life - 0.02 * dt
          }))
          .filter(p => p.life > 0);
      });

      physicsRef.current = requestAnimationFrame(updatePhysics);
    };

    physicsRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      if (physicsRef.current) cancelAnimationFrame(physicsRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [scene, selectedStage, isGameOver, isGameClear, phasesTriggered]);

  // --- マウスが重なっているすべてのエネミーを取得 ---
  const getEnemiesAt = (x: number, y: number): Enemy[] => {
    const list: Enemy[] = [];
    for (const enemy of enemies) {
      const dx = x - enemy.x;
      const dy = y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= enemy.size / 2) {
        list.push(enemy);
      }
    }
    return list;
  };

  // 現在のポインター位置における重なっている全てのエネミー
  const overlappingEnemies = getEnemiesAt(mousePos.x, mousePos.y);

  // --- マウス移動ハンドラ ---
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gameAreaRef.current) return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    
    // マウスのコンテナ内座標
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });
  };

  // --- 入力キー判定 ---
  // --- 入力キー判定 ---
  const handleInputMatch = (inputVal: string) => {
    if (isGameOver || isGameClear || scene !== 'game') return;

    if (overlappingEnemies.length > 0) {
      // 重なっているすべてのエネミーのうち、入力が合致するものを抽出して撃破
      const matchedEnemies = overlappingEnemies.filter(enemy => {
        return enemy.indicator.toLowerCase() === inputVal.toLowerCase();
      });

      if (matchedEnemies.length > 0) {
        // 撃破成功！
        triggerSE('success');
        setHitCount(prev => prev + matchedEnemies.length);
        
        // コンボ数を更新
        setCurrentCombo(prev => {
          const nextVal = prev + matchedEnemies.length;
          setMaxCombo(oldMax => Math.max(oldMax, nextVal));
          
          // 各撃破ターゲットの座標で撃破ビジュアルフィードバックを実行
          matchedEnemies.forEach((enemy, idx) => {
            createHitEffects(enemy.x, enemy.y, nextVal + idx);
          });
          
          return nextVal;
        });

        // 撃破した敵を削除
        const matchedIds = matchedEnemies.map(e => e.id);
        const updatedEnemies = enemies.filter(e => !matchedIds.includes(e.id));
        setEnemies(updatedEnemies);

        // 全撃破された時の判定
        if (updatedEnemies.length === 0) {
          if (spawnedCount >= selectedStage.totalEnemies) {
            handleStageCleared();
          } else {
            // まだ出現していない敵がいる場合は次のフェーズを即座にスポーン
            triggerNextPhase(selectedStage, spawnedCount, phasesTriggered);
          }
        }
      } else {
        // 入力ミスのカウント
        setCurrentCombo(0);
        setMissCount(prev => {
          const nextVal = prev + 1;
          if (nextVal >= 5) {
            setTimeout(() => {
              handleStageFailed();
            }, 0);
          }
          return nextVal;
        });
        createMissEffect(mousePos.x, mousePos.y);
      }
    } else {
      // 敵がいない場所での入力/クリックもミス判定
      setCurrentCombo(0);
      setMissCount(prev => {
        const nextVal = prev + 1;
        if (nextVal >= 5) {
          setTimeout(() => {
            handleStageFailed();
          }, 0);
        }
        return nextVal;
      });
      createMissEffect(mousePos.x, mousePos.y);
    }
  };

  // --- キーボードイベント監視 ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (scene !== 'game' || isGameOver || isGameClear) return;
      
      // ファンクションキーや修飾キーを除く、標準のキー入力を対象とする
      if (e.key.length === 1) {
        handleInputMatch(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [scene, enemies, overlappingEnemies, isGameOver, isGameClear, spawnedCount, phasesTriggered, selectedStage]);

  // --- ステージクリア / 失敗の処理 ---
  const handleStageCleared = () => {
    setIsGameClear(true);
    const endTime = Date.now();
    const duration = parseFloat(((endTime - startTimeRef.current) / 1000).toFixed(2));
    setClearTime(duration);
    triggerSE('clear');
    setScene('result');
  };

  const handleStageFailed = () => {
    setIsGameOver(true);
    setClearTime(selectedStage.duration);
    triggerSE('failed');
    setScene('result');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden relative">
      
      {/* SE再生 視覚フィードバック */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {seNotifications.map(notification => (
          <div
            key={notification.id}
            className={`px-4 py-2.5 rounded-lg border text-sm font-mono shadow-lg flex items-center gap-2 animate-bounce ${
              notification.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                : notification.type === 'clear'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-300'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>{notification.text}</span>
          </div>
        ))}
      </div>

      {/* --- タイトル画面 --- */}
      {scene === 'title' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative max-w-4xl mx-auto w-full">
          <div className="absolute inset-0 bg-radial from-indigo-500/10 via-transparent to-transparent -z-10" />
          
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-950/50 text-indigo-400 text-xs font-mono tracking-wider mb-2">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>TYPING & AIM SHOOTING</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-300">
              タイピングショット
            </h1>
            <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
              マウスで狙いを定め、赤い的（ターゲット）に表示されたキーをキーボードで入力して撃破するエイム＆タイピングゲーム。
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 max-w-md w-full backdrop-blur-md mb-8">
            <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-3 mb-4">基本操作・ルール</h2>
            <ul className="space-y-3.5 text-xs text-slate-400 font-mono">
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span>**エイム**: マウスでポインターを赤い的に重ねる。</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span>**キーボード入力**: アルファベット、数字、記号が表示されている場合は、該当するキーを押す。</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span>**複数同時撃破**: 的が重なっている場合、カーソルが重なっているすべての的の中で入力キーが一致するものを同時に撃破できます。</span>
              </li>
            </ul>
          </div>

          <button
            id="start-select-btn"
            onClick={() => setScene('select')}
            className="group px-8 py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all duration-200 text-white rounded-xl font-medium tracking-wide flex items-center gap-2.5 shadow-lg shadow-indigo-600/30 text-lg cursor-pointer"
          >
            <span>ステージ選択に進む</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* --- ステージ選択画面 --- */}
      {scene === 'select' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative max-w-5xl mx-auto w-full">
          <div className="text-center space-y-2 mb-12">
            <h1 className="text-3xl font-black tracking-tight text-white">ステージ選択</h1>
            <p className="text-slate-400 text-sm">全5ステージ。徐々に難易度と敵の移動速度・出現数が増加します。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl mb-12">
            {STAGES.map(stage => {
              const totalPhases = stage.phases.length;
              const sizeText = `${stage.baseEnemySize}px (±20%)`;
              return (
                <div
                  key={stage.id}
                  id={`stage-card-${stage.id}`}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-200"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono">
                        STAGE 0{stage.id}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">制限時間: 60秒</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-3">{stage.name}</h3>
                    
                    <div className="space-y-2 text-xs font-mono text-slate-400 border-t border-slate-800/60 pt-3">
                      <div className="flex justify-between">
                        <span>合計ターゲット数:</span>
                        <span className="text-indigo-400">{stage.totalEnemies}体</span>
                      </div>
                      <div className="flex justify-between">
                        <span>フェーズ構成:</span>
                        <span>{totalPhases}ウェーブ</span>
                      </div>
                      <div className="flex justify-between">
                        <span>的の基準サイズ:</span>
                        <span>{sizeText}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    id={`play-stage-btn-${stage.id}`}
                    onClick={() => startGame(stage)}
                    className="mt-6 w-full py-2.5 bg-slate-800 hover:bg-indigo-600 hover:text-white transition-all rounded-xl text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>このステージに挑戦</span>
                  </button>
                </div>
              );
            })}
          </div>

          <button
            id="back-to-title-btn"
            onClick={() => setScene('title')}
            className="px-5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            タイトルに戻る
          </button>
        </div>
      )}

      {/* --- ステージゲーム画面 --- */}
      {scene === 'game' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          
          {/* ゲーム上部ヘッダーUI */}
          <div className="w-full max-w-[960px] flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-slate-500 font-mono tracking-wider block uppercase">Playing</span>
                <span className="font-bold text-white text-sm">{selectedStage.name}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-xs text-slate-500 font-mono tracking-wider block uppercase">Progress</span>
                <span className="font-mono text-sm font-bold text-indigo-400">
                  撃破: {hitCount} / {selectedStage.totalEnemies} 体
                </span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-xs text-slate-500 font-mono tracking-wider block uppercase">Max Combo</span>
                <span className="font-mono text-sm font-bold text-amber-400">
                  {maxCombo} Combo
                </span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-xs text-rose-500 font-mono tracking-wider block uppercase">LIFE</span>
                <span className="font-mono text-sm font-bold text-rose-500 flex items-center gap-1">
                  {"❤️".repeat(Math.max(0, 5 - missCount))}
                  {"🖤".repeat(Math.max(0, missCount))}
                  <span className="text-[10px] text-slate-400 font-normal ml-0.5">({5 - missCount}/5)</span>
                </span>
              </div>
            </div>

            {/* リタイアボタン & 制限時間メーター */}
            <div className="flex items-center gap-6">
              <button
                id="btn-retire-game"
                onClick={handleStageFailed}
                className="px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>リタイア</span>
              </button>

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-rose-500" />
                <div className="text-right">
                  <span className="text-xs text-slate-500 font-mono block">TIME REMAINING</span>
                  <span className={`font-mono font-bold text-xl ${timeRemaining <= 10 ? 'text-rose-500 animate-pulse' : 'text-slate-100'}`}>
                    {timeRemaining.toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ゲームステージ領域 (長方形, 960x540 固定) */}
          <div
            id="game-stage-canvas"
            ref={gameAreaRef}
            onMouseMove={handleMouseMove}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setIsMouseInStage(true)}
            onMouseLeave={() => setIsMouseInStage(false)}
            onContextMenu={(e) => e.preventDefault()}
            className="relative w-[960px] h-[540px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-indigo-950/20 overflow-hidden cursor-none"
            style={{ contentVisibility: 'auto' }}
          >
            {/* 的 (エネミー) */}
            {enemies.map((enemy) => {
              const isTargetActive = overlappingEnemies.some(oe => oe.id === enemy.id);

              return (
                <div
                  key={enemy.id}
                  id={`enemy-${enemy.id}`}
                  className="absolute rounded-full flex items-center justify-center transition-shadow duration-100 select-none cursor-none"
                  style={{
                    left: `${enemy.x}px`,
                    top: `${enemy.y}px`,
                    width: `${enemy.size}px`,
                    height: `${enemy.size}px`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: enemy.zIndex,
                    backgroundColor: isTargetActive ? '#ef4444' : '#dc2626',
                    border: isTargetActive ? '4px solid #fef08a' : '2px solid rgba(255, 255, 255, 0.4)',
                    boxShadow: isTargetActive 
                      ? '0 0 20px rgba(254, 240, 138, 0.6), inset 0 0 12px rgba(0,0,0,0.4)' 
                      : '0 4px 10px rgba(0, 0, 0, 0.3), inset 0 0 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {/* 指示テキスト */}
                  <span
                    className={`font-mono font-black tracking-tighter ${
                      isTargetActive ? 'text-yellow-200' : 'text-white'
                    } text-2xl`}
                    style={{
                      // エネミーの円サイズに合わせたテキストサイズ調整
                      fontSize: `${Math.max(16, enemy.size * 0.28)}px`,
                    }}
                  >
                    {enemy.indicator}
                  </span>

                  {/* 等速・変化や移動などのバッジ（開発視覚用、必要なければシンプルにするが、お洒落さのため配置） */}
                  {enemy.speedType === 'variable' && (
                    <span className="absolute -bottom-1 px-1 py-0.2 bg-indigo-500 text-[8px] text-white font-mono uppercase rounded border border-white/20">
                      ⚡
                    </span>
                  )}
                </div>
              );
            })}

            {/* 照準表示（クロスヘア） */}
            {isMouseInStage && (
              <div
                id="crosshair"
                className="absolute pointer-events-none transition-transform duration-75 mix-blend-difference"
                style={{
                  left: `${mousePos.x}px`,
                  top: `${mousePos.y}px`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 9999,
                }}
              >
                {/* シンプルな十字クロスヘア */}
                <svg width="40" height="40" viewBox="0 0 40 40" className="text-white fill-none stroke-current">
                  <circle cx="20" cy="20" r="14" strokeWidth="1" strokeDasharray="3, 3" />
                  <circle cx="20" cy="20" r="2" strokeWidth="1" className="fill-current" />
                  <line x1="20" y1="2" x2="20" y2="12" strokeWidth="2" />
                  <line x1="20" y1="28" x2="20" y2="38" strokeWidth="2" />
                  <line x1="2" y1="20" x2="12" y2="20" strokeWidth="2" />
                  <line x1="28" y1="20" x2="38" y2="20" strokeWidth="2" />
                </svg>
              </div>
            )}

            {/* ミス時の赤フラッシュエフェクト */}
            {isMissFlashing && (
              <div 
                id="miss-flash-overlay"
                className="absolute inset-0 bg-rose-600/20 border-4 border-rose-500 pointer-events-none z-50 animate-pulse duration-100" 
              />
            )}

            {/* 浮き上がるポップアップテキスト */}
            {popups.map(pop => (
              <div
                key={pop.id}
                id={pop.id}
                className={`absolute pointer-events-none font-sans select-none tracking-tight transition-opacity duration-100 ${pop.colorClass}`}
                style={{
                  left: `${pop.x}px`,
                  top: `${pop.y}px`,
                  opacity: pop.life,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 9999,
                }}
              >
                {pop.text}
              </div>
            ))}

            {/* 弾けるパーティクルエフェクト */}
            {particles.map(p => (
              <div
                key={p.id}
                id={p.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: `${p.x}px`,
                  top: `${p.y}px`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  backgroundColor: p.color,
                  opacity: p.alpha,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 9998,
                }}
              />
            ))}

            {/* 現在のコンボインジケーター表示 */}
            {currentCombo > 0 && (
              <div 
                id="combo-streak-container"
                className="absolute top-4 right-4 pointer-events-none flex flex-col items-end z-40 animate-bounce"
              >
                <span className="text-[9px] font-mono font-bold text-amber-500 tracking-widest uppercase">Combo Streak</span>
                <span className="text-4xl font-black font-mono text-amber-400 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]">
                  {currentCombo}
                </span>
              </div>
            )}

            {/* 未出現ターゲットを知らせるテキスト（フッター） */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-slate-800 text-[10px] font-mono text-slate-400 tracking-wider flex items-center gap-2">
              <span>アクティブターゲット: {enemies.length}体</span>
              <span>•</span>
              <span>未出現の待ちターゲット: {selectedStage.totalEnemies - spawnedCount}体</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-6 text-xs font-mono text-slate-500">
            <span>※ マウスクリックでの入力時は、的の上で各種クリックを行ってください。</span>
            <span>※ 右クリックによるコンテキストメニューはゲーム領域内で無効化されます。</span>
          </div>
        </div>
      )}

      {/* --- クリア/失敗画面 (結果画面) --- */}
      {scene === 'result' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative max-w-4xl mx-auto w-full animate-fade-in">
          <div className="absolute inset-0 bg-radial from-indigo-500/5 via-transparent to-transparent -z-10" />

          <div className="text-center space-y-3 mb-10">
            {isGameClear ? (
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Award className="w-4 h-4" />
                <span>SUCCESS - ステージクリア！</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-rose-500/30 bg-rose-950/40 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <AlertCircle className="w-4 h-4" />
                <span>FAILED - タイムアップ！</span>
              </div>
            )}
            <h1 className="text-4xl font-black tracking-tight text-white">
              {isGameClear ? 'ステージクリア！' : 'ミッション失敗...'}
            </h1>
            <p className="text-slate-400 text-sm">
              {selectedStage.name}の最終リザルト
            </p>
          </div>

          {/* リザルト統計パネル */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-3xl mb-12">
            
            {/* クリアタイム / 経過時間 */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <Clock className={`w-6 h-6 mb-2 ${isGameClear ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span className="text-xs text-slate-500 font-mono">
                {isGameClear ? 'クリアタイム' : '経過時間'}
              </span>
              <span className="text-2xl font-black font-mono text-white mt-1">
                {clearTime.toFixed(2)}秒
              </span>
            </div>

            {/* 撃破数 */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <Flame className="w-6 h-6 mb-2 text-rose-500" />
              <span className="text-xs text-slate-500 font-mono">撃破数</span>
              <span className="text-2xl font-black font-mono text-white mt-1">
                {hitCount} / {selectedStage.totalEnemies} 体
              </span>
            </div>

            {/* 最大コンボ数 */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <Zap className="w-6 h-6 mb-2 text-amber-400" />
              <span className="text-xs text-slate-500 font-mono">最大コンボ数</span>
              <span className="text-2xl font-black font-mono text-white mt-1">
                {maxCombo} Combo
              </span>
            </div>

            {/* タイピングの正確さ(ミスタイプ数) */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <Percent className="w-6 h-6 mb-2 text-indigo-400" />
              <span className="text-xs text-slate-500 font-mono">ミスタイプ数</span>
              <span className="text-2xl font-black font-mono text-white mt-1">
                {missCount}回
              </span>
            </div>

          </div>

          {/* ナビゲーションアクションボタン */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <button
              id="btn-retry-stage"
              onClick={() => startGame(selectedStage)}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white rounded-xl font-medium text-sm flex items-center gap-2 cursor-pointer min-w-[160px] justify-center"
            >
              <RotateCcw className="w-4 h-4" />
              <span>もう一度挑戦する</span>
            </button>

            {isGameClear && selectedStage.id < 5 && (
              <button
                id="btn-next-stage"
                onClick={() => {
                  const nextStage = STAGES.find(s => s.id === selectedStage.id + 1);
                  if (nextStage) startGame(nextStage);
                }}
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white rounded-xl font-medium text-sm flex items-center gap-2 cursor-pointer min-w-[160px] justify-center"
              >
                <span>次のステージへ</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <button
              id="btn-return-select"
              onClick={() => setScene('select')}
              className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 hover:text-white transition-all text-slate-300 rounded-xl font-medium text-sm flex items-center justify-center cursor-pointer min-w-[160px]"
            >
              <span>ステージ選択に戻る</span>
            </button>
          </div>
        </div>
      )}

      {/* フッター */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs font-mono text-slate-600 mt-auto">
        <span>© 2026 2D TYPING SHOOTING SPECIFICATION GAME</span>
      </footer>
    </div>
  );
}

