/*
 * CLAUDRON FACE WIDGET — with location movement & sprite flipping
 *
 * Body: pixel art purple flame/wisp sprite (static PNG, faces RIGHT)
 * Face: HTML/CSS overlay with dynamic mood-based expressions
 * Movement: reads locations.json, smoothly moves between named locations
 * Flipping: sprite flips horizontally (scaleX(-1)) when moving LEFT
 *
 * Approach: flip the ENTIRE outer container with scaleX(-1) when moving left.
 * Counter-flip the speech bubble so text stays readable.
 */

export const refreshFrequency = 2000;

export const command = `
  M=$(cat /Users/rcfox31/.openclaw/workspace/dashboard/mood.json 2>/dev/null || echo '{"mood":"happy","status":""}')
  L=$(cat /Users/rcfox31/.openclaw/workspace/dashboard/locations.json 2>/dev/null | tr -d '\\n' || echo '{}')
  echo "{\\"mood_data\\":$M,\\"loc_data\\":$L}"
`;

// --- Mood config ---
const MOODS = {
  happy:    { eyeColor: '#4ADE80', eyeStyle: 'normal', mouth: 'smug',  brows: 'none' },
  thinking: { eyeColor: '#4ADE80', eyeStyle: 'side',   mouth: 'smirk', brows: 'thinking' },
  sleeping: { eyeColor: '#4ADE80', eyeStyle: 'closed', mouth: 'snore', brows: 'none' },
  angry:    { eyeColor: '#FF4444', eyeStyle: 'normal', mouth: 'frown', brows: 'angry' },
  excited:  { eyeColor: '#4ADE80', eyeStyle: 'big',    mouth: 'cat',   brows: 'none' },
};

// --- Persistent state (survives re-renders within same Übersicht session) ---
let prevX = null;
let facingLeft = false; // sprite faces RIGHT by default; facingLeft means flipped

// --- Screen geometry ---
const SCREEN_H = 600;

export const className = `
  position: fixed;
  top: 0;
  left: 0;
  width: 1024px;
  height: 600px;
  z-index: 9999;
  pointer-events: none;

  @keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
  @keyframes pulse {
    0%, 100% { filter: drop-shadow(0 0 8px #4ADE80); }
    50% { filter: drop-shadow(0 0 16px #4ADE80); }
  }
  @keyframes pulseRed {
    0%, 100% { filter: drop-shadow(0 0 8px #FF4444); }
    50% { filter: drop-shadow(0 0 16px #FF4444); }
  }
  @keyframes blink {
    0%, 92%, 100% { transform: scaleY(1); }
    95% { transform: scaleY(0.1); }
  }
  @keyframes snore {
    0%, 100% { width: 5px; height: 5px; }
    50% { width: 8px; height: 8px; }
  }
  @keyframes zzz {
    0%, 100% { opacity: 0; transform: translate(0, 0) scale(0.6); }
    50% { opacity: 1; transform: translate(10px, -20px) scale(1); }
  }
`;

// --- Components (same as working version) ---

const Eyes = ({ m }) => {
  const c = MOODS[m] || MOODS.happy;
  const isAngry = m === 'angry';
  const glowColor = isAngry ? '#FF4444' : '#4ADE80';
  const glow = `0 0 4px ${glowColor}, 0 0 8px ${glowColor}`;
  const base = { position: 'absolute', background: c.eyeColor, borderRadius: '50%' };

  if (c.eyeStyle === 'closed') {
    const closedStyle = { position: 'absolute', background: '#C4B5FD', top: '70px', width: '8px', height: '2px', borderRadius: '1px' };
    return (
      <div>
        <div style={{...closedStyle, left: '117px'}} />
        <div style={{...closedStyle, left: '139px'}} />
      </div>
    );
  }
  if (c.eyeStyle === 'big') {
    const eyeStyle = { ...base, top: '68px', width: '12px', height: '12px', boxShadow: glow, animation: 'blink 4s infinite', transformOrigin: 'center' };
    return (
      <div>
        <div style={{...eyeStyle, left: '114px'}} />
        <div style={{...eyeStyle, left: '140px'}} />
      </div>
    );
  }
  const shift = c.eyeStyle === 'side' ? '2px' : '0';
  const eyeStyle = { ...base, top: '68px', width: '10px', height: '10px', boxShadow: glow, transform: `translateX(${shift})`, animation: 'blink 4s infinite', transformOrigin: 'center' };
  return (
    <div>
      <div style={{...eyeStyle, left: '115px'}} />
      <div style={{...eyeStyle, left: '141px'}} />
    </div>
  );
};

const Blush = ({ m }) => {
  if (m !== 'excited' && m !== 'happy') return null;
  const blush = { position: 'absolute', top: '78px', width: '10px', height: '5px', borderRadius: '50%', background: 'rgba(255,100,140,0.55)', boxShadow: '0 0 4px rgba(255,100,140,0.3)' };
  return (
    <div>
      <div style={{...blush, left: '113px'}} />
      <div style={{...blush, left: '141px'}} />
    </div>
  );
};

const Brows = ({ m }) => {
  if (m === 'angry') {
    const base = { position: 'absolute', width: '10px', height: '2px', background: '#FF4444' };
    return (
      <div>
        <div style={{...base, top: '64px', left: '113px', transform: 'rotate(15deg)'}} />
        <div style={{...base, top: '64px', left: '141px', transform: 'rotate(-15deg)'}} />
      </div>
    );
  }
  if (m === 'thinking') {
    return (
      <div style={{position: 'absolute', top: '62px', left: '139px', width: '10px', height: '2px', background: '#C4B5FD', borderRadius: '1px', transform: 'rotate(-10deg)'}} />
    );
  }
  return null;
};

const Mouth = ({ m }) => {
  const c = MOODS[m] || MOODS.happy;
  const base = { position: 'absolute' };
  if (c.mouth === 'smug')
    return <div style={{...base, top: '85px', left: '129px', width: '8px', height: '4px', borderBottom: '2px solid #C4B5FD', borderRadius: '0 0 5px 5px'}} />;
  if (c.mouth === 'smirk')
    return <div style={{...base, top: '85px', left: '130px', width: '6px', height: '3px', borderBottom: '2px solid #C4B5FD', borderRadius: '0 0 5px 1px'}} />;
  if (c.mouth === 'frown')
    return <div style={{...base, top: '87px', left: '130px', width: '6px', height: '3px', borderTop: '2px solid #FF6666', borderRadius: '5px 5px 0 0'}} />;
  if (c.mouth === 'cat')
    return (
      <svg style={{...base, top: '83px', left: '126px'}} width="12" height="6" viewBox="0 0 12 6">
        <path d="M0,1 Q3,6 6,1 Q9,6 12,1" fill="none" stroke="#C4B5FD" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  if (c.mouth === 'snore')
    return <div style={{...base, top: '84px', left: '131px', width: '5px', height: '5px', borderRadius: '50%', border: '2px solid #C4B5FD', animation: 'snore 2.5s ease-in-out infinite'}} />;
  // flat (fallback)
  return <div style={{...base, top: '86px', left: '130px', width: '6px', height: '0px', borderTop: '2px solid #C4B5FD'}} />;
};

const Zzz = ({ m }) => {
  if (m !== 'sleeping') return null;
  return (
    <div style={{position: 'absolute', top: '50px', right: '23px', color: '#A78BFA', fontSize: '14px', fontFamily: 'monospace', animation: 'zzz 2s infinite'}}>
      zZ
    </div>
  );
};

const Bubble = ({ text, flipped }) => {
  if (!text) return null;
  return (
    <div style={{
      position: 'absolute',
      bottom: '90%',
      left: '133px',
      // Counter-flip text when container is flipped
      transform: `translateX(-50%)${flipped ? ' scaleX(-1)' : ''}`,
      background: 'rgba(30,20,50,0.85)',
      border: '1px solid #7B5EA7',
      borderRadius: '8px',
      padding: '4px 10px',
      color: '#E0D0FF',
      fontSize: '11px',
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {text}
      <div style={{
        position: 'absolute',
        bottom: '-6px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid rgba(30,20,50,0.85)',
      }} />
    </div>
  );
};

// --- Main render ---

export const render = ({ output }) => {
  let mood = 'happy', status = '';
  let cssLeft = 200, cssBottom = 117;
  let flipped = facingLeft;

  try {
    const d = JSON.parse(output);
    const moodData = d.mood_data || d;
    const locData = d.loc_data || {};

    mood = moodData.mood || 'happy';
    status = moodData.status || '';

    const currentName = locData.current;
    const locations = locData.locations || {};
    const offset = locData.spriteOffset || { mouthFromLeft: 125, mouthFromBottom: 83 };

    if (currentName && locations[currentName]) {
      const loc = locations[currentName];
      cssLeft = loc.x - offset.mouthFromLeft;
      cssBottom = (SCREEN_H - loc.y) - offset.mouthFromBottom;

      // Determine flip direction: sprite faces RIGHT by default
      // Priority: per-location facing > global facing override > movement direction
      if (loc.facing === 'left') {
        facingLeft = true;
      } else if (loc.facing === 'right') {
        facingLeft = false;
      } else if (locData.facing === 'left') {
        facingLeft = true;
      } else if (locData.facing === 'right') {
        facingLeft = false;
      } else if (prevX !== null && loc.x !== prevX) {
        facingLeft = loc.x < prevX;
      }
      prevX = loc.x;
      flipped = facingLeft;
    }
  } catch (e) {}

  const pulseAnim = mood === 'angry' ? 'pulseRed' : 'pulse';

  return (
    <div style={{
      position: 'absolute',
      left: `${cssLeft}px`,
      bottom: `${cssBottom}px`,
      transition: 'left 2s ease-in-out, bottom 2s ease-in-out',
      transform: flipped ? 'scaleX(-1)' : 'none',
    }}>
      <div style={{animation: 'bob 3s ease-in-out infinite', position: 'relative'}}>
        <Bubble text={status} flipped={flipped} />
        <div style={{
          width: '200px',
          height: '183px',
          position: 'relative',
          animation: `${pulseAnim} 3s ease-in-out infinite`,
        }}>
          <img
            src="http://localhost:8420/sprites/body-final-transparent.png"
            style={{
              width: '200px',
              height: '183px',
              imageRendering: 'pixelated',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '200px',
            height: '183px',
          }}>
            <Eyes m={mood} />
            <Blush m={mood} />
            <Brows m={mood} />
            <Mouth m={mood} />
            <Zzz m={mood} />
          </div>
        </div>
      </div>
    </div>
  );
};
