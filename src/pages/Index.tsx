import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

type Team = 'CT' | 'T' | null;
type GameState = 'menu' | 'playing' | 'dead';
type WeaponType = 'rifle' | 'pistol' | 'knife';

interface Bot {
  id: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  health: number;
  alive: boolean;
  patrolIndex: number;
  shootCooldown: number;
}

interface Player {
  x: number;
  y: number;
  z: number;
  rotation: number;
  pitch: number;
  health: number;
  ammo: number;
  team: Team;
  weapon: WeaponType;
  reserveAmmo: number;
}

interface Weapon {
  type: WeaponType;
  name: string;
  damage: number;
  ammo: number;
  maxAmmo: number;
  fireRate: number;
}

const WEAPONS: Record<WeaponType, Weapon> = {
  rifle: { type: 'rifle', name: 'AK-47', damage: 50, ammo: 30, maxAmmo: 30, fireRate: 100 },
  pistol: { type: 'pistol', name: 'Desert Eagle', damage: 35, ammo: 7, maxAmmo: 7, fireRate: 300 },
  knife: { type: 'knife', name: 'Нож', damage: 100, ammo: 999, maxAmmo: 999, fireRate: 500 },
};

const Index = () => {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [selectedTeam, setSelectedTeam] = useState<Team>(null);
  const [player, setPlayer] = useState<Player>({
    x: 0,
    y: 1.7,
    z: 0,
    rotation: 0,
    pitch: 0,
    health: 100,
    ammo: 30,
    team: null,
    weapon: 'rifle',
    reserveAmmo: 90,
  });
  const [bots, setBots] = useState<Bot[]>([]);
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});
  const [mouseMovement, setMouseMovement] = useState({ x: 0, y: 0 });
  const [shooting, setShooting] = useState(false);
  const [recoil, setRecoil] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const [inspectRotation, setInspectRotation] = useState(0);
  const [weaponBob, setWeaponBob] = useState(0);
  const [reloading, setReloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [killCount, setKillCount] = useState(0);

  useEffect(() => {
    if (gameState === 'playing') {
      const newBots: Bot[] = [];
      for (let i = 0; i < 5; i++) {
        newBots.push({
          id: i,
          x: Math.random() * 40 - 20,
          y: 0,
          z: Math.random() * 40 - 20,
          rotation: Math.random() * Math.PI * 2,
          health: 100,
          alive: true,
          patrolIndex: 0,
          shootCooldown: 0,
        });
      }
      setBots(newBots);
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setKeys((prev) => ({ ...prev, [key]: true }));

      if (key === 'y' && !inspecting && !reloading) {
        setInspecting(true);
        setInspectRotation(0);
        setTimeout(() => setInspecting(false), 2000);
      }

      if (key === '1') {
        setPlayer((prev) => ({ ...prev, weapon: 'rifle', ammo: WEAPONS.rifle.ammo }));
      }
      if (key === '2') {
        setPlayer((prev) => ({ ...prev, weapon: 'pistol', ammo: WEAPONS.pistol.ammo }));
      }
      if (key === '3') {
        setPlayer((prev) => ({ ...prev, weapon: 'knife', ammo: WEAPONS.knife.ammo }));
      }

      if (key === 'r' && !reloading && player.weapon !== 'knife') {
        const currentWeapon = WEAPONS[player.weapon];
        if (player.ammo < currentWeapon.maxAmmo && player.reserveAmmo > 0) {
          setReloading(true);
          setTimeout(() => {
            setPlayer((prev) => {
              const needed = currentWeapon.maxAmmo - prev.ammo;
              const toReload = Math.min(needed, prev.reserveAmmo);
              return {
                ...prev,
                ammo: prev.ammo + toReload,
                reserveAmmo: prev.reserveAmmo - toReload,
              };
            });
            setReloading(false);
          }, 1500);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [inspecting, reloading, player.weapon, player.ammo, player.reserveAmmo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        setMouseMovement({ x: e.movementX, y: e.movementY });
      }
    };

    const handleClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      } else {
        if (player.ammo > 0 && !shooting && !inspecting && !reloading) {
          const currentWeapon = WEAPONS[player.weapon];
          setShooting(true);
          setRecoil(player.weapon === 'rifle' ? 15 : player.weapon === 'pistol' ? 10 : 5);

          if (player.weapon !== 'knife') {
            setPlayer((prev) => ({ ...prev, ammo: prev.ammo - 1 }));
          }

          const hitBotIndex = checkBotHit();
          if (hitBotIndex !== -1) {
            setBots((prev) => {
              const newBots = [...prev];
              newBots[hitBotIndex].health -= currentWeapon.damage;
              if (newBots[hitBotIndex].health <= 0) {
                newBots[hitBotIndex].alive = false;
                setKillCount((count) => count + 1);
              }
              return newBots;
            });
          }

          setTimeout(() => setShooting(false), currentWeapon.fireRate);
        }
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [gameState, player.ammo, shooting, inspecting, reloading, player.weapon]);

  const checkBotHit = () => {
    const rayAngle = player.rotation;
    const rayDirX = Math.sin(rayAngle);
    const rayDirZ = Math.cos(rayAngle);

    for (let i = 0; i < bots.length; i++) {
      if (!bots[i].alive) continue;

      const dx = bots[i].x - player.x;
      const dz = bots[i].z - player.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > 30) continue;

      const dotProduct = (dx * rayDirX + dz * rayDirZ) / distance;
      if (dotProduct > 0.98) {
        return i;
      }
    }
    return -1;
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const updateGame = () => {
      setPlayer((prev) => {
        let newX = prev.x;
        let newZ = prev.z;
        const newRotation = prev.rotation - mouseMovement.x * 0.002;
        const newPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, prev.pitch + mouseMovement.y * 0.002));

        const speed = 0.1;
        const forward = { x: Math.sin(newRotation) * speed, z: Math.cos(newRotation) * speed };
        const right = { x: Math.sin(newRotation + Math.PI / 2) * speed, z: Math.cos(newRotation + Math.PI / 2) * speed };

        let isMoving = false;
        if (keys['w']) {
          newX += forward.x;
          newZ += forward.z;
          isMoving = true;
        }
        if (keys['s']) {
          newX -= forward.x;
          newZ -= forward.z;
          isMoving = true;
        }
        if (keys['a']) {
          newX -= right.x;
          newZ -= right.z;
          isMoving = true;
        }
        if (keys['d']) {
          newX += right.x;
          newZ += right.z;
          isMoving = true;
        }

        if (isMoving) {
          setWeaponBob((prev) => prev + 0.15);
        }

        newX = Math.max(-25, Math.min(25, newX));
        newZ = Math.max(-25, Math.min(25, newZ));

        return { ...prev, x: newX, z: newZ, rotation: newRotation, pitch: newPitch };
      });

      setMouseMovement({ x: 0, y: 0 });

      if (recoil > 0) {
        setRecoil((prev) => Math.max(0, prev - 1));
      }

      if (inspecting) {
        setInspectRotation((prev) => prev + 0.05);
      }

      setBots((prevBots) =>
        prevBots.map((bot) => {
          if (!bot.alive) return bot;

          const dx = player.x - bot.x;
          const dz = player.z - bot.z;
          const distanceToPlayer = Math.sqrt(dx * dx + dz * dz);

          let newShootCooldown = Math.max(0, bot.shootCooldown - 1);

          if (distanceToPlayer < 20 && newShootCooldown === 0) {
            const hitChance = Math.random();
            if (hitChance > 0.8) {
              setPlayer((prev) => {
                const newHealth = prev.health - 10;
                if (newHealth <= 0) {
                  setGameState('dead');
                }
                return { ...prev, health: newHealth };
              });
            }
            newShootCooldown = 60;
          }

          const targetRotation = Math.atan2(dx, dz);
          let newX = bot.x;
          let newZ = bot.z;

          if (distanceToPlayer > 10) {
            const moveSpeed = 0.03;
            newX += Math.sin(targetRotation) * moveSpeed;
            newZ += Math.cos(targetRotation) * moveSpeed;
          } else if (distanceToPlayer < 5) {
            const moveSpeed = 0.02;
            newX -= Math.sin(targetRotation) * moveSpeed;
            newZ -= Math.cos(targetRotation) * moveSpeed;
          }

          return {
            ...bot,
            x: newX,
            z: newZ,
            rotation: targetRotation,
            shootCooldown: newShootCooldown,
          };
        })
      );
    };

    const gameLoop = setInterval(updateGame, 16);
    return () => clearInterval(gameLoop);
  }, [gameState, keys, mouseMovement, player, bots, recoil, inspecting]);

  const drawWeapon = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const bobOffset = Math.sin(weaponBob) * 5;
    const inspectOffset = inspecting ? Math.sin(inspectRotation * 2) * 50 : 0;
    const reloadOffset = reloading ? -150 : 0;

    ctx.save();

    if (player.weapon === 'rifle') {
      const baseX = width - 400 + inspectOffset;
      const baseY = height - 200 + bobOffset + reloadOffset;

      ctx.fillStyle = '#1A1F2C';
      ctx.fillRect(baseX, baseY, 350, 40);

      ctx.fillStyle = '#34495E';
      ctx.fillRect(baseX + 50, baseY - 20, 60, 60);

      ctx.fillStyle = '#F97316';
      ctx.fillRect(baseX + 300, baseY + 10, 50, 20);

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(baseX - 80, baseY + 5, 100, 30);

      ctx.fillStyle = '#2C3E50';
      ctx.fillRect(baseX + 100, baseY + 5, 30, 30);

      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(baseX + 115, baseY - 40, 15, 0, Math.PI * 2);
      ctx.fill();

      if (shooting) {
        ctx.fillStyle = '#FFA500';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFA500';
        ctx.beginPath();
        ctx.arc(baseX + 350, baseY + 20, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(baseX, baseY, 350, 40);
    } else if (player.weapon === 'pistol') {
      const baseX = width - 250 + inspectOffset;
      const baseY = height - 180 + bobOffset + reloadOffset;

      ctx.fillStyle = '#2C3E50';
      ctx.fillRect(baseX, baseY, 200, 35);

      ctx.fillStyle = '#1A1F2C';
      ctx.fillRect(baseX - 30, baseY + 5, 50, 50);

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(baseX - 50, baseY + 15, 30, 30);

      ctx.fillStyle = '#F97316';
      ctx.fillRect(baseX + 180, baseY + 10, 20, 15);

      ctx.fillStyle = '#555';
      ctx.fillRect(baseX + 60, baseY - 15, 40, 20);

      if (shooting) {
        ctx.fillStyle = '#FFA500';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFA500';
        ctx.beginPath();
        ctx.arc(baseX + 200, baseY + 18, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(baseX, baseY, 200, 35);
    } else if (player.weapon === 'knife') {
      const baseX = width - 200 + inspectOffset;
      const baseY = height - 150 + bobOffset;
      const rotation = inspecting ? inspectRotation : 0.3;

      ctx.translate(baseX, baseY);
      ctx.rotate(rotation);

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(-20, 0, 40, 120);

      ctx.fillStyle = '#C0C0C0';
      ctx.beginPath();
      ctx.moveTo(0, -100);
      ctx.lineTo(-15, 0);
      ctx.lineTo(15, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#A9A9A9';
      ctx.fillRect(-3, -100, 6, 100);

      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -100);
      ctx.lineTo(-15, 0);
      ctx.lineTo(15, 0);
      ctx.closePath();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#2C3E50';
      const horizonY = canvas.height / 2 + player.pitch * 300 - recoil * 2;
      ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

      for (let x = -25; x <= 25; x += 2) {
        for (let z = -25; z <= 25; z += 2) {
          const worldX = x - player.x;
          const worldZ = z - player.z;

          const rotatedX = worldX * Math.cos(-player.rotation) - worldZ * Math.sin(-player.rotation);
          const rotatedZ = worldX * Math.sin(-player.rotation) + worldZ * Math.cos(-player.rotation);

          if (rotatedZ > 0.1) {
            const screenX = (rotatedX / rotatedZ) * 600 + canvas.width / 2;
            const screenY = horizonY + (1.7 / rotatedZ) * 300;

            const size = 400 / rotatedZ;

            if ((x + z) % 4 === 0) {
              ctx.fillStyle = '#34495E';
            } else {
              ctx.fillStyle = '#2C3E50';
            }
            ctx.fillRect(screenX - size / 2, screenY, size, size);
          }
        }
      }

      const walls = [
        { x1: -25, z1: -25, x2: 25, z2: -25 },
        { x1: 25, z1: -25, x2: 25, z2: 25 },
        { x1: 25, z1: 25, x2: -25, z2: 25 },
        { x1: -25, z1: 25, x2: -25, z2: -25 },
        { x1: -10, z1: -10, x2: 10, z2: -10 },
        { x1: 10, z1: -10, x2: 10, z2: 10 },
      ];

      walls.forEach((wall) => {
        const x1 = wall.x1 - player.x;
        const z1 = wall.z1 - player.z;
        const x2 = wall.x2 - player.x;
        const z2 = wall.z2 - player.z;

        const rx1 = x1 * Math.cos(-player.rotation) - z1 * Math.sin(-player.rotation);
        const rz1 = x1 * Math.sin(-player.rotation) + z1 * Math.cos(-player.rotation);
        const rx2 = x2 * Math.cos(-player.rotation) - z2 * Math.sin(-player.rotation);
        const rz2 = x2 * Math.sin(-player.rotation) + z2 * Math.cos(-player.rotation);

        if (rz1 > 0.1 && rz2 > 0.1) {
          const sx1 = (rx1 / rz1) * 600 + canvas.width / 2;
          const sy1Top = horizonY - (3 / rz1) * 300;
          const sy1Bottom = horizonY + (1.7 / rz1) * 300;

          const sx2 = (rx2 / rz2) * 600 + canvas.width / 2;
          const sy2Top = horizonY - (3 / rz2) * 300;
          const sy2Bottom = horizonY + (1.7 / rz2) * 300;

          ctx.fillStyle = '#5D6D7E';
          ctx.beginPath();
          ctx.moveTo(sx1, sy1Top);
          ctx.lineTo(sx2, sy2Top);
          ctx.lineTo(sx2, sy2Bottom);
          ctx.lineTo(sx1, sy1Bottom);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#34495E';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      bots.forEach((bot) => {
        if (!bot.alive) return;

        const dx = bot.x - player.x;
        const dz = bot.z - player.z;

        const rotatedX = dx * Math.cos(-player.rotation) - dz * Math.sin(-player.rotation);
        const rotatedZ = dx * Math.sin(-player.rotation) + dz * Math.cos(-player.rotation);

        if (rotatedZ > 0.1) {
          const screenX = (rotatedX / rotatedZ) * 600 + canvas.width / 2;
          const screenY = horizonY - (0.3 / rotatedZ) * 300;

          const size = 150 / rotatedZ;

          ctx.fillStyle = '#8B4513';
          ctx.fillRect(screenX - size / 2, screenY - size * 2, size, size * 2);

          ctx.fillStyle = '#D2691E';
          ctx.beginPath();
          ctx.arc(screenX, screenY - size * 2.3, size * 0.4, 0, Math.PI * 2);
          ctx.fill();

          const healthBarWidth = size;
          const healthBarHeight = 5;
          ctx.fillStyle = '#000';
          ctx.fillRect(screenX - healthBarWidth / 2, screenY - size * 3, healthBarWidth, healthBarHeight);
          ctx.fillStyle = bot.health > 50 ? '#0EA5E9' : '#F97316';
          ctx.fillRect(
            screenX - healthBarWidth / 2,
            screenY - size * 3,
            healthBarWidth * (bot.health / 100),
            healthBarHeight
          );
        }
      });

      drawWeapon(ctx, canvas.width, canvas.height);

      if (!inspecting && player.weapon !== 'knife') {
        ctx.strokeStyle = shooting ? '#F97316' : '#fff';
        ctx.lineWidth = 2;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 - recoil;
        ctx.beginPath();
        ctx.moveTo(centerX - 15, centerY);
        ctx.lineTo(centerX + 15, centerY);
        ctx.moveTo(centerX, centerY - 15);
        ctx.lineTo(centerX, centerY + 15);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, player, bots, shooting, recoil, inspecting, inspectRotation, weaponBob, reloading]);

  const startGame = () => {
    if (selectedTeam) {
      setPlayer((prev) => ({ ...prev, team: selectedTeam }));
      setGameState('playing');
      setKillCount(0);
    }
  };

  const resetGame = () => {
    setGameState('menu');
    setSelectedTeam(null);
    setPlayer({
      x: 0,
      y: 1.7,
      z: 0,
      rotation: 0,
      pitch: 0,
      health: 100,
      ammo: 30,
      team: null,
      weapon: 'rifle',
      reserveAmmo: 90,
    });
  };

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] via-[#2C3E50] to-[#34495E] flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 bg-[#2C3E50]/90 border-[#5D6D7E] backdrop-blur">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-2 tracking-wider">TACTICAL OPS</h1>
            <p className="text-gray-300">Выберите команду</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setSelectedTeam('CT')}
              className={`p-8 rounded-lg border-2 transition-all ${
                selectedTeam === 'CT'
                  ? 'border-[#0EA5E9] bg-[#0EA5E9]/20 scale-105'
                  : 'border-[#5D6D7E] bg-[#34495E]/50 hover:border-[#0EA5E9]/50'
              }`}
            >
              <div className="text-6xl mb-4">🛡️</div>
              <h3 className="text-2xl font-bold text-white mb-2">Counter-Terrorists</h3>
              <p className="text-gray-300 text-sm">Защищайте периметр</p>
            </button>

            <button
              onClick={() => setSelectedTeam('T')}
              className={`p-8 rounded-lg border-2 transition-all ${
                selectedTeam === 'T'
                  ? 'border-[#F97316] bg-[#F97316]/20 scale-105'
                  : 'border-[#5D6D7E] bg-[#34495E]/50 hover:border-[#F97316]/50'
              }`}
            >
              <div className="text-6xl mb-4">💣</div>
              <h3 className="text-2xl font-bold text-white mb-2">Terrorists</h3>
              <p className="text-gray-300 text-sm">Захватите объект</p>
            </button>
          </div>

          <Button
            onClick={startGame}
            disabled={!selectedTeam}
            className="w-full py-6 text-xl font-bold bg-[#0EA5E9] hover:bg-[#0EA5E9]/80 text-white disabled:opacity-50"
          >
            Начать игру
          </Button>

          <div className="mt-6 p-4 bg-[#1A1F2C]/50 rounded-lg">
            <h4 className="text-white font-bold mb-2 flex items-center gap-2">
              <Icon name="Info" size={20} />
              Управление
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
              <div>• WASD - движение</div>
              <div>• Мышь - обзор</div>
              <div>• ЛКМ - стрельба</div>
              <div>• R - перезарядка</div>
              <div>• Y - осмотр оружия</div>
              <div>• 1/2/3 - смена оружия</div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (gameState === 'dead') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] to-[#ea384c] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-[#2C3E50]/90 border-[#ea384c] backdrop-blur text-center">
          <div className="text-6xl mb-4">💀</div>
          <h2 className="text-4xl font-bold text-white mb-4">ВЫ УБИТЫ</h2>
          <p className="text-gray-300 mb-2">Убито врагов: {killCount}</p>
          <p className="text-gray-300 mb-6">Финальное здоровье: 0 HP</p>
          <Button onClick={resetGame} className="w-full py-4 text-lg bg-[#0EA5E9] hover:bg-[#0EA5E9]/80">
            Вернуться в меню
          </Button>
        </Card>
      </div>
    );
  }

  const currentWeapon = WEAPONS[player.weapon];

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <canvas ref={canvasRef} width={1920} height={1080} className="w-full h-full" />

      <div className="absolute top-4 left-4 space-y-2">
        <div className="bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur flex items-center gap-2">
          <Icon name="Heart" size={20} className="text-[#ea384c]" />
          <span className="font-bold">{Math.max(0, player.health)} HP</span>
        </div>
        <div className="bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Target" size={20} className="text-[#F97316]" />
            <span className="font-bold">{currentWeapon.name}</span>
          </div>
          {player.weapon !== 'knife' && (
            <div className="text-sm">
              Патроны: {player.ammo} / {player.reserveAmmo}
            </div>
          )}
        </div>
        <div className="bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur flex items-center gap-2">
          <Icon name="Skull" size={20} className="text-[#0EA5E9]" />
          <span className="font-bold">Убито: {killCount}</span>
        </div>
      </div>

      <div className="absolute top-4 right-4">
        <div
          className={`px-4 py-2 rounded-lg backdrop-blur font-bold ${
            player.team === 'CT' ? 'bg-[#0EA5E9]/70 text-white' : 'bg-[#F97316]/70 text-white'
          }`}
        >
          {player.team === 'CT' ? '🛡️ Counter-Terrorist' : '💣 Terrorist'}
        </div>
      </div>

      {reloading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="bg-black/70 text-white px-8 py-4 rounded-lg backdrop-blur text-2xl font-bold">
            Перезарядка...
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-lg backdrop-blur">
        <p className="text-sm">Кликните для захвата курсора | ESC для выхода</p>
      </div>

      <button
        onClick={resetGame}
        className="absolute bottom-4 right-4 bg-[#ea384c]/80 hover:bg-[#ea384c] text-white px-4 py-2 rounded-lg backdrop-blur flex items-center gap-2"
      >
        <Icon name="LogOut" size={20} />
        Выход
      </button>
    </div>
  );
};

export default Index;
