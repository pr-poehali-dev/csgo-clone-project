import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

type Team = 'CT' | 'T' | null;
type GameState = 'menu' | 'teamSelect' | 'playing' | 'dead';
type WeaponType = 'rifle' | 'pistol' | 'knife' | 'awp' | 'smg';

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
  money: number;
}

interface Weapon {
  type: WeaponType;
  name: string;
  damage: number;
  ammo: number;
  maxAmmo: number;
  fireRate: number;
  price: number;
}

interface CheatSettings {
  aimbot: boolean;
  esp: boolean;
  speed: boolean;
  fly: boolean;
}

interface Settings {
  graphicsQuality: number;
  sensitivity: number;
  fov: number;
}

const WEAPONS: Record<WeaponType, Weapon> = {
  rifle: { type: 'rifle', name: 'AK-47', damage: 50, ammo: 30, maxAmmo: 30, fireRate: 100, price: 2700 },
  pistol: { type: 'pistol', name: 'Desert Eagle', damage: 35, ammo: 7, maxAmmo: 7, fireRate: 300, price: 700 },
  knife: { type: 'knife', name: 'Нож', damage: 100, ammo: 999, maxAmmo: 999, fireRate: 500, price: 0 },
  awp: { type: 'awp', name: 'AWP', damage: 100, ammo: 10, maxAmmo: 10, fireRate: 1500, price: 4750 },
  smg: { type: 'smg', name: 'MP9', damage: 25, ammo: 30, maxAmmo: 30, fireRate: 80, price: 1250 },
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
    weapon: 'pistol',
    reserveAmmo: 90,
    money: 800,
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
  const [cheatMenuOpen, setCheatMenuOpen] = useState(false);
  const [buyMenuOpen, setBuyMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cheats, setCheats] = useState<CheatSettings>({
    aimbot: false,
    esp: false,
    speed: false,
    fly: false,
  });
  const [settings, setSettings] = useState<Settings>({
    graphicsQuality: 100,
    sensitivity: 50,
    fov: 90,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [killCount, setKillCount] = useState(0);

  const playShootSound = () => {
    const freq = player.weapon === 'rifle' ? 100 : player.weapon === 'pistol' ? 150 : player.weapon === 'awp' ? 80 : 120;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(player.weapon === 'awp' ? 0.5 : 0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const playReloadSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const createClick = (time: number, freq: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.05);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(audioContext.currentTime + time);
      oscillator.stop(audioContext.currentTime + time + 0.05);
    };
    
    createClick(0, 300);
    createClick(0.3, 250);
    createClick(0.6, 350);
  };

  useEffect(() => {
    if (gameState === 'playing') {
      const newBots: Bot[] = [];
      for (let i = 0; i < 5; i++) {
        newBots.push({
          id: i,
          x: Math.random() * 40 - 20,
          y: Math.random() > 0.5 ? 1.7 : 4.5,
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
      
      if (e.shiftKey && e.location === 2) {
        setCheatMenuOpen((prev) => !prev);
        return;
      }

      if (key === 'b' && gameState === 'playing') {
        setBuyMenuOpen((prev) => !prev);
        return;
      }

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
          playReloadSound();
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
  }, [inspecting, reloading, player.weapon, player.ammo, player.reserveAmmo, gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        const sensitivity = settings.sensitivity / 50;
        setMouseMovement({ x: e.movementX * sensitivity, y: e.movementY * sensitivity });
      }
    };

    const handleClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      } else {
        if (player.ammo > 0 && !shooting && !inspecting && !reloading && !buyMenuOpen) {
          const currentWeapon = WEAPONS[player.weapon];
          setShooting(true);
          setRecoil(player.weapon === 'rifle' ? 15 : player.weapon === 'pistol' ? 10 : player.weapon === 'awp' ? 30 : 5);
          playShootSound();

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
                setPlayer((p) => ({ ...p, money: p.money + 300 }));
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
  }, [gameState, player.ammo, shooting, inspecting, reloading, player.weapon, settings.sensitivity, buyMenuOpen]);

  const checkBotHit = () => {
    const rayAngle = player.rotation;
    const rayDirX = Math.sin(rayAngle);
    const rayDirZ = Math.cos(rayAngle);

    for (let i = 0; i < bots.length; i++) {
      if (!bots[i].alive) continue;

      const dx = bots[i].x - player.x;
      const dz = bots[i].z - player.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > 50) continue;

      const dotProduct = (dx * rayDirX + dz * rayDirZ) / distance;
      if (dotProduct > 0.98) {
        return i;
      }
    }
    return -1;
  };

  const findNearestBot = () => {
    let nearestBot = null;
    let minDistance = Infinity;

    bots.forEach((bot) => {
      if (!bot.alive) return;
      const dx = bot.x - player.x;
      const dz = bot.z - player.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < minDistance) {
        minDistance = distance;
        nearestBot = bot;
      }
    });

    return nearestBot;
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const updateGame = () => {
      setPlayer((prev) => {
        let newX = prev.x;
        let newZ = prev.z;
        let newY = prev.y;
        let newRotation = prev.rotation - mouseMovement.x * 0.002;
        let newPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, prev.pitch + mouseMovement.y * 0.002));

        if (cheats.aimbot) {
          const nearestBot = findNearestBot();
          if (nearestBot) {
            const dx = nearestBot.x - newX;
            const dz = nearestBot.z - newZ;
            newRotation = Math.atan2(dx, dz);
            newPitch = 0;
          }
        }

        const speed = cheats.speed ? 0.3 : 0.1;
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

        if (cheats.fly) {
          if (keys[' ']) {
            newY += 0.1;
          }
          if (keys['shift']) {
            newY -= 0.1;
          }
        } else {
          newY = 1.7;
        }

        if (isMoving) {
          setWeaponBob((prev) => prev + 0.15);
        }

        newX = Math.max(-30, Math.min(30, newX));
        newZ = Math.max(-30, Math.min(30, newZ));
        newY = Math.max(0.5, Math.min(10, newY));

        return { ...prev, x: newX, y: newY, z: newZ, rotation: newRotation, pitch: newPitch };
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
  }, [gameState, keys, mouseMovement, player, bots, recoil, inspecting, cheats]);

  const drawWeapon = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const bobOffset = Math.sin(weaponBob) * 5;
    const inspectOffset = inspecting ? Math.sin(inspectRotation * 2) * 50 : 0;
    const reloadOffset = reloading ? -150 : 0;

    ctx.save();

    if (player.weapon === 'rifle') {
      const baseX = width - 450 + inspectOffset;
      const baseY = height - 220 + bobOffset + reloadOffset;

      const bodyGradient = ctx.createLinearGradient(baseX, baseY, baseX + 400, baseY + 50);
      bodyGradient.addColorStop(0, '#0A0A0A');
      bodyGradient.addColorStop(0.3, '#1A1F2C');
      bodyGradient.addColorStop(0.7, '#2C3E50');
      bodyGradient.addColorStop(1, '#1A1A1A');
      ctx.fillStyle = bodyGradient;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 15;
      ctx.fillRect(baseX, baseY, 400, 50);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#0F1419';
      ctx.fillRect(baseX + 60, baseY - 25, 70, 75);

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(baseX - 100, baseY + 8, 120, 35);
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(baseX - 100 + i * 25, baseY + 8);
        ctx.lineTo(baseX - 100 + i * 25, baseY + 43);
        ctx.stroke();
      }

      ctx.fillStyle = '#2C3E50';
      ctx.fillRect(baseX + 120, baseY + 10, 35, 35);

      const magGradient = ctx.createLinearGradient(baseX + 160, baseY + 50, baseX + 160, baseY + 120);
      magGradient.addColorStop(0, '#1A1A1A');
      magGradient.addColorStop(1, '#0A0A0A');
      ctx.fillStyle = magGradient;
      ctx.fillRect(baseX + 150, baseY + 50, 30, 70);

      ctx.fillStyle = '#F97316';
      ctx.shadowColor = '#F97316';
      ctx.shadowBlur = 10;
      ctx.fillRect(baseX + 370, baseY + 15, 30, 20);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(baseX + 130, baseY - 50, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (shooting) {
        const muzzleGradient = ctx.createRadialGradient(baseX + 400, baseY + 25, 0, baseX + 400, baseY + 25, 50);
        muzzleGradient.addColorStop(0, '#FFFFFF');
        muzzleGradient.addColorStop(0.2, '#FFD700');
        muzzleGradient.addColorStop(0.5, '#FFA500');
        muzzleGradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
        ctx.fillStyle = muzzleGradient;
        ctx.shadowColor = '#FFA500';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(baseX + 400, baseY + 25, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 3;
      ctx.strokeRect(baseX, baseY, 400, 50);
    } else if (player.weapon === 'awp') {
      const baseX = width - 500 + inspectOffset;
      const baseY = height - 200 + bobOffset + reloadOffset;

      const bodyGradient = ctx.createLinearGradient(baseX, baseY, baseX + 450, baseY + 40);
      bodyGradient.addColorStop(0, '#0D4D0D');
      bodyGradient.addColorStop(0.5, '#1A5C1A');
      bodyGradient.addColorStop(1, '#0A3A0A');
      ctx.fillStyle = bodyGradient;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 20;
      ctx.fillRect(baseX, baseY, 450, 40);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(baseX + 80, baseY - 30, 80, 100);

      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(baseX + 200, baseY - 60, 100, 40);
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(baseX + 250, baseY - 50);
      ctx.lineTo(baseX + 250, baseY - 30);
      ctx.moveTo(baseX + 240, baseY - 40);
      ctx.lineTo(baseX + 260, baseY - 40);
      ctx.stroke();

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(baseX - 80, baseY + 5, 100, 30);

      if (shooting) {
        const muzzleGradient = ctx.createRadialGradient(baseX + 450, baseY + 20, 0, baseX + 450, baseY + 20, 60);
        muzzleGradient.addColorStop(0, '#FFFFFF');
        muzzleGradient.addColorStop(0.2, '#FFD700');
        muzzleGradient.addColorStop(0.5, '#FFA500');
        muzzleGradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
        ctx.fillStyle = muzzleGradient;
        ctx.shadowColor = '#FFA500';
        ctx.shadowBlur = 40;
        ctx.beginPath();
        ctx.arc(baseX + 450, baseY + 20, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else if (player.weapon === 'smg') {
      const baseX = width - 350 + inspectOffset;
      const baseY = height - 190 + bobOffset + reloadOffset;

      const bodyGradient = ctx.createLinearGradient(baseX, baseY, baseX + 300, baseY + 45);
      bodyGradient.addColorStop(0, '#1A1A1A');
      bodyGradient.addColorStop(0.5, '#2C2C2C');
      bodyGradient.addColorStop(1, '#0A0A0A');
      ctx.fillStyle = bodyGradient;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 12;
      ctx.fillRect(baseX, baseY, 300, 45);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(baseX + 50, baseY - 15, 50, 60);

      ctx.fillStyle = '#333';
      ctx.fillRect(baseX + 100, baseY + 10, 25, 30);

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(baseX - 60, baseY + 10, 80, 25);

      if (shooting) {
        const muzzleGradient = ctx.createRadialGradient(baseX + 300, baseY + 22, 0, baseX + 300, baseY + 22, 35);
        muzzleGradient.addColorStop(0, '#FFF');
        muzzleGradient.addColorStop(0.3, '#FFA500');
        muzzleGradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
        ctx.fillStyle = muzzleGradient;
        ctx.shadowColor = '#FFA500';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(baseX + 300, baseY + 22, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else if (player.weapon === 'pistol') {
      const baseX = width - 280 + inspectOffset;
      const baseY = height - 180 + bobOffset + reloadOffset;

      const slideGradient = ctx.createLinearGradient(baseX, baseY, baseX + 220, baseY + 40);
      slideGradient.addColorStop(0, '#1A1A1A');
      slideGradient.addColorStop(0.5, '#2C3E50');
      slideGradient.addColorStop(1, '#0A0A0A');
      ctx.fillStyle = slideGradient;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 10;
      ctx.fillRect(baseX, baseY, 220, 40);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#0F1419';
      ctx.fillRect(baseX - 35, baseY + 5, 55, 55);

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(baseX - 60, baseY + 15, 35, 35);

      ctx.fillStyle = '#F97316';
      ctx.fillRect(baseX + 195, baseY + 12, 25, 16);

      ctx.fillStyle = '#444';
      ctx.fillRect(baseX + 70, baseY - 18, 45, 22);

      if (shooting) {
        const muzzleGradient = ctx.createRadialGradient(baseX + 220, baseY + 20, 0, baseX + 220, baseY + 20, 25);
        muzzleGradient.addColorStop(0, '#FFF');
        muzzleGradient.addColorStop(0.4, '#FFA500');
        muzzleGradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
        ctx.fillStyle = muzzleGradient;
        ctx.shadowColor = '#FFA500';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(baseX + 220, baseY + 20, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.strokeRect(baseX, baseY, 220, 40);
    } else if (player.weapon === 'knife') {
      const baseX = width - 200 + inspectOffset;
      const baseY = height - 150 + bobOffset;
      const rotation = inspecting ? inspectRotation : 0.3;

      ctx.translate(baseX, baseY);
      ctx.rotate(rotation);

      const handleGradient = ctx.createLinearGradient(-20, 0, 20, 120);
      handleGradient.addColorStop(0, '#654321');
      handleGradient.addColorStop(0.5, '#8B4513');
      handleGradient.addColorStop(1, '#5C3317');
      ctx.fillStyle = handleGradient;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      ctx.fillRect(-22, 0, 44, 125);
      ctx.shadowBlur = 0;

      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = '#3E2723';
        ctx.fillRect(-22, i * 20, 44, 2);
      }

      const bladeGradient = ctx.createLinearGradient(-18, -120, 18, 0);
      bladeGradient.addColorStop(0, '#F0F0F0');
      bladeGradient.addColorStop(0.3, '#E0E0E0');
      bladeGradient.addColorStop(0.5, '#C0C0C0');
      bladeGradient.addColorStop(0.7, '#A9A9A9');
      bladeGradient.addColorStop(1, '#909090');
      ctx.fillStyle = bladeGradient;
      ctx.beginPath();
      ctx.moveTo(0, -120);
      ctx.lineTo(-18, 0);
      ctx.lineTo(18, 0);
      ctx.closePath();
      ctx.fill();

      const edgeGradient = ctx.createLinearGradient(-5, -120, 5, 0);
      edgeGradient.addColorStop(0, '#FFFFFF');
      edgeGradient.addColorStop(0.5, '#E8E8E8');
      edgeGradient.addColorStop(1, '#D0D0D0');
      ctx.fillStyle = edgeGradient;
      ctx.fillRect(-5, -120, 10, 120);

      ctx.strokeStyle = '#404040';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -120);
      ctx.lineTo(-18, 0);
      ctx.lineTo(18, 0);
      ctx.closePath();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  };

  const buyWeapon = (weaponType: WeaponType) => {
    const weapon = WEAPONS[weaponType];
    if (player.money >= weapon.price) {
      setPlayer((prev) => ({
        ...prev,
        weapon: weaponType,
        ammo: weapon.ammo,
        reserveAmmo: weapon.maxAmmo * 2,
        money: prev.money - weapon.price,
      }));
      setBuyMenuOpen(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const quality = settings.graphicsQuality / 100;

      const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height / 2);
      skyGradient.addColorStop(0, quality > 0.5 ? '#87CEEB' : '#6BB6D6');
      skyGradient.addColorStop(1, quality > 0.5 ? '#B0E0E6' : '#95D0DB');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const horizonY = canvas.height / 2 + player.pitch * 300 - recoil * 2;
      
      const groundGradient = ctx.createLinearGradient(0, horizonY, 0, canvas.height);
      groundGradient.addColorStop(0, '#4A6F6F');
      groundGradient.addColorStop(0.5, '#2C3E50');
      groundGradient.addColorStop(1, '#1A1F2C');
      ctx.fillStyle = groundGradient;
      ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

      const gridStep = quality > 0.7 ? 2 : quality > 0.4 ? 3 : 4;
      for (let x = -30; x <= 30; x += gridStep) {
        for (let z = -30; z <= 30; z += gridStep) {
          const worldX = x - player.x;
          const worldZ = z - player.z;

          const rotatedX = worldX * Math.cos(-player.rotation) - worldZ * Math.sin(-player.rotation);
          const rotatedZ = worldX * Math.sin(-player.rotation) + worldZ * Math.cos(-player.rotation);

          if (rotatedZ > 0.1) {
            const screenX = (rotatedX / rotatedZ) * 600 + canvas.width / 2;
            const screenY = horizonY + ((player.y - 1.7) / rotatedZ) * 300;

            const size = 400 / rotatedZ;
            const brightness = Math.max(50, 150 - rotatedZ * 3);

            if ((x + z) % 4 === 0) {
              ctx.fillStyle = `rgb(${brightness + 20}, ${brightness + 30}, ${brightness + 40})`;
            } else {
              ctx.fillStyle = `rgb(${brightness}, ${brightness + 10}, ${brightness + 20})`;
            }
            ctx.fillRect(screenX - size / 2, screenY, size, size);

            if (quality > 0.6) {
              ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 / rotatedZ})`;
              ctx.lineWidth = 1;
              ctx.strokeRect(screenX - size / 2, screenY, size, size);
            }
          }
        }
      }

      const complexWalls = [
        { x1: -30, z1: -30, x2: 30, z2: -30, h: 4, color: '#7F8C8D' },
        { x1: 30, z1: -30, x2: 30, z2: 30, h: 4, color: '#95A5A6' },
        { x1: 30, z1: 30, x2: -30, z2: 30, h: 4, color: '#7F8C8D' },
        { x1: -30, z1: 30, x2: -30, z2: -30, h: 4, color: '#95A5A6' },
        
        { x1: -15, z1: -15, x2: 15, z2: -15, h: 3, color: '#6C7A89' },
        { x1: 15, z1: -15, x2: 15, z2: 15, h: 3, color: '#5D6D7E' },
        { x1: -20, z1: 10, x2: -10, z2: 10, h: 2.5, color: '#99754D' },
        { x1: 20, z1: -10, x2: 25, z2: -10, h: 2.5, color: '#99754D' },
        { x1: -5, z1: -25, x2: 5, z2: -25, h: 3.5, color: '#8B7D6B' },
        { x1: -25, z1: 0, x2: -20, z2: 0, h: 6, color: '#A67C52' },
      ];

      complexWalls.forEach((wall) => {
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
          const sy1Top = horizonY - ((wall.h - player.y + 1.7) / rz1) * 300;
          const sy1Bottom = horizonY + ((player.y - 1.7) / rz1) * 300;

          const sx2 = (rx2 / rz2) * 600 + canvas.width / 2;
          const sy2Top = horizonY - ((wall.h - player.y + 1.7) / rz2) * 300;
          const sy2Bottom = horizonY + ((player.y - 1.7) / rz2) * 300;

          const wallGradient = ctx.createLinearGradient(sx1, sy1Top, sx1, sy1Bottom);
          wallGradient.addColorStop(0, wall.color);
          wallGradient.addColorStop(0.5, `${wall.color}DD`);
          wallGradient.addColorStop(1, `${wall.color}BB`);
          ctx.fillStyle = wallGradient;
          
          ctx.beginPath();
          ctx.moveTo(sx1, sy1Top);
          ctx.lineTo(sx2, sy2Top);
          ctx.lineTo(sx2, sy2Bottom);
          ctx.lineTo(sx1, sy1Bottom);
          ctx.closePath();
          ctx.fill();

          if (quality > 0.5) {
            ctx.strokeStyle = '#34495E';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
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
          const screenY = horizonY - ((bot.y - player.y) / rotatedZ) * 300;

          const size = 150 / rotatedZ;

          if (cheats.esp) {
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 3;
            ctx.strokeRect(screenX - size / 2 - 5, screenY - size * 2.5 - 5, size + 10, size * 2.5 + 10);
            
            ctx.fillStyle = '#FF0000';
            ctx.font = '16px monospace';
            ctx.fillText(`${bot.health} HP`, screenX - 25, screenY - size * 2.7);
            
            const distance = Math.sqrt(dx * dx + dz * dz).toFixed(1);
            ctx.fillText(`${distance}m`, screenX - 20, screenY + 20);
          }

          const bodyGradient = ctx.createLinearGradient(
            screenX - size / 2,
            screenY - size * 2,
            screenX + size / 2,
            screenY
          );
          bodyGradient.addColorStop(0, '#8B4513');
          bodyGradient.addColorStop(0.5, '#A0522D');
          bodyGradient.addColorStop(1, '#6B3410');
          ctx.fillStyle = bodyGradient;
          if (quality > 0.6) {
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 5;
          }
          ctx.fillRect(screenX - size / 2, screenY - size * 2, size, size * 2);
          ctx.shadowBlur = 0;

          const headGradient = ctx.createRadialGradient(
            screenX,
            screenY - size * 2.3,
            size * 0.2,
            screenX,
            screenY - size * 2.3,
            size * 0.4
          );
          headGradient.addColorStop(0, '#E8B89A');
          headGradient.addColorStop(1, '#D2691E');
          ctx.fillStyle = headGradient;
          ctx.beginPath();
          ctx.arc(screenX, screenY - size * 2.3, size * 0.4, 0, Math.PI * 2);
          ctx.fill();

          const healthBarWidth = size;
          const healthBarHeight = 5;
          ctx.fillStyle = '#000';
          ctx.fillRect(screenX - healthBarWidth / 2, screenY - size * 3, healthBarWidth, healthBarHeight);
          
          const healthGradient = ctx.createLinearGradient(
            screenX - healthBarWidth / 2,
            0,
            screenX + healthBarWidth / 2,
            0
          );
          if (bot.health > 50) {
            healthGradient.addColorStop(0, '#00FF00');
            healthGradient.addColorStop(1, '#0EA5E9');
          } else {
            healthGradient.addColorStop(0, '#F97316');
            healthGradient.addColorStop(1, '#FF0000');
          }
          ctx.fillStyle = healthGradient;
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
        ctx.strokeStyle = shooting ? '#FF0000' : cheats.aimbot ? '#00FF00' : '#FFFFFF';
        ctx.lineWidth = 2;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 - recoil;
        
        if (quality > 0.5) {
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 5;
        }
        
        ctx.beginPath();
        ctx.moveTo(centerX - 15, centerY);
        ctx.lineTo(centerX - 5, centerY);
        ctx.moveTo(centerX + 5, centerY);
        ctx.lineTo(centerX + 15, centerY);
        ctx.moveTo(centerX, centerY - 15);
        ctx.lineTo(centerX, centerY - 5);
        ctx.moveTo(centerX, centerY + 5);
        ctx.lineTo(centerX, centerY + 15);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(20, 20, 180, 180);
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, 180, 180);

      const radarCenterX = 110;
      const radarCenterY = 110;
      const radarScale = 3;

      ctx.fillStyle = '#00FF00';
      ctx.beginPath();
      ctx.arc(radarCenterX, radarCenterY, 5, 0, Math.PI * 2);
      ctx.fill();

      bots.forEach((bot) => {
        if (!bot.alive) return;
        const dx = (bot.x - player.x) * radarScale;
        const dz = (bot.z - player.z) * radarScale;
        
        const radarX = radarCenterX + dx;
        const radarY = radarCenterY + dz;

        if (radarX > 20 && radarX < 200 && radarY > 20 && radarY < 200) {
          ctx.fillStyle = cheats.esp ? '#FF0000' : '#FF6666';
          ctx.beginPath();
          ctx.arc(radarX, radarY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(radarCenterX, radarCenterY);
      const lineLength = 15;
      const lineX = radarCenterX + Math.sin(player.rotation) * lineLength;
      const lineY = radarCenterY + Math.cos(player.rotation) * lineLength;
      ctx.lineTo(lineX, lineY);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, player, bots, shooting, recoil, inspecting, inspectRotation, weaponBob, reloading, cheats, settings]);

  const startGame = () => {
    setGameState('teamSelect');
  };

  const selectTeam = (team: Team) => {
    setSelectedTeam(team);
    setPlayer((prev) => ({ ...prev, team }));
    setGameState('playing');
    setKillCount(0);
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
      ammo: 7,
      team: null,
      weapon: 'pistol',
      reserveAmmo: 14,
      money: 800,
    });
    setCheats({
      aimbot: false,
      esp: false,
      speed: false,
      fly: false,
    });
  };

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#1A0000] to-[#000000] flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 bg-black/90 border-[#FF0000] backdrop-blur">
          <div className="text-center mb-8">
            <h1 className="text-6xl font-bold text-[#FF0000] mb-2 tracking-wider drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]">
              TACTICAL OPS
            </h1>
            <p className="text-gray-400">Режим: Соревновательный</p>
          </div>

          <Button
            onClick={startGame}
            className="w-full py-6 text-2xl font-bold bg-[#00FF00] hover:bg-[#00DD00] text-black mb-4 shadow-[0_0_20px_rgba(0,255,0,0.5)]"
          >
            ИГРАТЬ
          </Button>

          <Button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full py-4 text-xl font-bold bg-[#333] hover:bg-[#444] text-white mb-4"
          >
            <Icon name="Settings" size={24} className="mr-2" />
            НАСТРОЙКИ
          </Button>

          {settingsOpen && (
            <div className="p-6 bg-[#1A1A1A] rounded-lg border-2 border-[#333] mb-4">
              <h3 className="text-white font-bold mb-4">Настройки</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-gray-300 text-sm mb-2 block flex items-center gap-2">
                    <Icon name="MonitorPlay" size={16} />
                    Качество графики: {settings.graphicsQuality}%
                  </label>
                  <Slider
                    value={[settings.graphicsQuality]}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, graphicsQuality: value[0] }))}
                    min={25}
                    max={100}
                    step={25}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-gray-300 text-sm mb-2 block flex items-center gap-2">
                    <Icon name="MousePointer" size={16} />
                    Чувствительность мыши: {settings.sensitivity}%
                  </label>
                  <Slider
                    value={[settings.sensitivity]}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, sensitivity: value[0] }))}
                    min={10}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-gray-300 text-sm mb-2 block flex items-center gap-2">
                    <Icon name="Eye" size={16} />
                    Поле зрения (FOV): {settings.fov}°
                  </label>
                  <Slider
                    value={[settings.fov]}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, fov: value[0] }))}
                    min={60}
                    max={120}
                    step={10}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-[#0A0A0A] rounded-lg border border-[#333]">
            <h4 className="text-[#FF0000] font-bold mb-2 flex items-center gap-2">
              <Icon name="Info" size={20} />
              Управление
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
              <div>• WASD - движение</div>
              <div>• Мышь - обзор</div>
              <div>• ЛКМ - стрельба</div>
              <div>• R - перезарядка</div>
              <div>• Y - осмотр оружия</div>
              <div>• 1/2/3 - смена оружия</div>
              <div>• B - меню закупки</div>
              <div>• Правый Shift - читы</div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (gameState === 'teamSelect') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] via-[#2C3E50] to-[#34495E] flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 bg-[#2C3E50]/90 border-[#5D6D7E] backdrop-blur">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Выберите команду</h1>
            <p className="text-gray-300">Раунд начнется после выбора</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <button
              onClick={() => selectTeam('CT')}
              className="p-8 rounded-lg border-2 border-[#0EA5E9] bg-[#0EA5E9]/20 hover:bg-[#0EA5E9]/30 hover:scale-105 transition-all"
            >
              <div className="text-6xl mb-4">🛡️</div>
              <h3 className="text-2xl font-bold text-white mb-2">Counter-Terrorists</h3>
              <p className="text-gray-300 text-sm">Защищайте периметр</p>
            </button>

            <button
              onClick={() => selectTeam('T')}
              className="p-8 rounded-lg border-2 border-[#F97316] bg-[#F97316]/20 hover:bg-[#F97316]/30 hover:scale-105 transition-all"
            >
              <div className="text-6xl mb-4">💣</div>
              <h3 className="text-2xl font-bold text-white mb-2">Terrorists</h3>
              <p className="text-gray-300 text-sm">Захватите объект</p>
            </button>
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
          <p className="text-gray-300 mb-2">Заработано: ${killCount * 300}</p>
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
        <div className="bg-black/70 text-[#00FF00] px-4 py-2 rounded-lg backdrop-blur flex items-center gap-2">
          <Icon name="DollarSign" size={20} className="text-[#00FF00]" />
          <span className="font-bold">${player.money}</span>
        </div>
      </div>

      {cheatMenuOpen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/90 border-2 border-[#00FF00] rounded-lg p-4 backdrop-blur z-50">
          <h3 className="text-[#00FF00] font-bold mb-3 text-center flex items-center gap-2 justify-center">
            <Icon name="Terminal" size={20} />
            CHEAT MENU
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <label className="text-white text-sm flex items-center gap-2">
                <Icon name="Crosshair" size={16} className="text-[#00FF00]" />
                Aimbot
              </label>
              <Switch
                checked={cheats.aimbot}
                onCheckedChange={(checked) => setCheats((prev) => ({ ...prev, aimbot: checked }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-white text-sm flex items-center gap-2">
                <Icon name="Eye" size={16} className="text-[#00FF00]" />
                ESP Wallhack
              </label>
              <Switch
                checked={cheats.esp}
                onCheckedChange={(checked) => setCheats((prev) => ({ ...prev, esp: checked }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-white text-sm flex items-center gap-2">
                <Icon name="Zap" size={16} className="text-[#00FF00]" />
                Speed Hack
              </label>
              <Switch
                checked={cheats.speed}
                onCheckedChange={(checked) => setCheats((prev) => ({ ...prev, speed: checked }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-white text-sm flex items-center gap-2">
                <Icon name="Plane" size={16} className="text-[#00FF00]" />
                Fly Mode
              </label>
              <Switch
                checked={cheats.fly}
                onCheckedChange={(checked) => setCheats((prev) => ({ ...prev, fly: checked }))}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Правый Shift - закрыть</p>
        </div>
      )}

      {buyMenuOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/95 border-2 border-[#FFD700] rounded-lg p-6 backdrop-blur z-50 min-w-[500px]">
          <h3 className="text-[#FFD700] font-bold mb-4 text-2xl text-center flex items-center gap-2 justify-center">
            <Icon name="ShoppingCart" size={24} />
            МЕНЮ ЗАКУПКИ
          </h3>
          <p className="text-center text-[#00FF00] mb-4">Доступно: ${player.money}</p>
          
          <div className="space-y-3">
            <button
              onClick={() => buyWeapon('pistol')}
              disabled={player.money < WEAPONS.pistol.price}
              className={`w-full p-4 rounded-lg border-2 flex items-center justify-between ${
                player.money >= WEAPONS.pistol.price
                  ? 'border-[#00FF00] bg-[#00FF00]/10 hover:bg-[#00FF00]/20'
                  : 'border-gray-600 bg-gray-800/50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="Target" size={24} className="text-white" />
                <div className="text-left">
                  <div className="text-white font-bold">{WEAPONS.pistol.name}</div>
                  <div className="text-sm text-gray-400">Урон: {WEAPONS.pistol.damage}</div>
                </div>
              </div>
              <div className="text-[#FFD700] font-bold">${WEAPONS.pistol.price}</div>
            </button>

            <button
              onClick={() => buyWeapon('smg')}
              disabled={player.money < WEAPONS.smg.price}
              className={`w-full p-4 rounded-lg border-2 flex items-center justify-between ${
                player.money >= WEAPONS.smg.price
                  ? 'border-[#00FF00] bg-[#00FF00]/10 hover:bg-[#00FF00]/20'
                  : 'border-gray-600 bg-gray-800/50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="Zap" size={24} className="text-white" />
                <div className="text-left">
                  <div className="text-white font-bold">{WEAPONS.smg.name}</div>
                  <div className="text-sm text-gray-400">Урон: {WEAPONS.smg.damage}</div>
                </div>
              </div>
              <div className="text-[#FFD700] font-bold">${WEAPONS.smg.price}</div>
            </button>

            <button
              onClick={() => buyWeapon('rifle')}
              disabled={player.money < WEAPONS.rifle.price}
              className={`w-full p-4 rounded-lg border-2 flex items-center justify-between ${
                player.money >= WEAPONS.rifle.price
                  ? 'border-[#00FF00] bg-[#00FF00]/10 hover:bg-[#00FF00]/20'
                  : 'border-gray-600 bg-gray-800/50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="Crosshair" size={24} className="text-white" />
                <div className="text-left">
                  <div className="text-white font-bold">{WEAPONS.rifle.name}</div>
                  <div className="text-sm text-gray-400">Урон: {WEAPONS.rifle.damage}</div>
                </div>
              </div>
              <div className="text-[#FFD700] font-bold">${WEAPONS.rifle.price}</div>
            </button>

            <button
              onClick={() => buyWeapon('awp')}
              disabled={player.money < WEAPONS.awp.price}
              className={`w-full p-4 rounded-lg border-2 flex items-center justify-between ${
                player.money >= WEAPONS.awp.price
                  ? 'border-[#00FF00] bg-[#00FF00]/10 hover:bg-[#00FF00]/20'
                  : 'border-gray-600 bg-gray-800/50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="Crosshair" size={24} className="text-[#FF0000]" />
                <div className="text-left">
                  <div className="text-white font-bold">{WEAPONS.awp.name}</div>
                  <div className="text-sm text-gray-400">Урон: {WEAPONS.awp.damage} (снайпер)</div>
                </div>
              </div>
              <div className="text-[#FFD700] font-bold">${WEAPONS.awp.price}</div>
            </button>
          </div>

          <button
            onClick={() => setBuyMenuOpen(false)}
            className="w-full mt-4 p-3 bg-[#ea384c] hover:bg-[#d12d3f] text-white rounded-lg font-bold"
          >
            Закрыть (B)
          </button>
        </div>
      )}

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
          <div className="bg-black/70 text-white px-8 py-4 rounded-lg backdrop-blur text-2xl font-bold flex items-center gap-3">
            <Icon name="RotateCw" size={24} className="animate-spin" />
            Перезарядка...
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-lg backdrop-blur">
        <p className="text-sm">Кликните для захвата курсора | B - закупка | ESC для выхода</p>
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
