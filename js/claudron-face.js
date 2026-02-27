/**
 * ============================================================================
 * File:     dashboard/claudron-face.js
 * Purpose:  Shared Face Rendering Module for Claudron's Sprite
 *
 * Renders Claudron's facial expression (eyes, mouth, brows, blush) into a
 * container element using DOM elements and CSS animations. Supports multiple
 * moods: happy, thinking, sleeping, angry, excited.
 *
 * Usage:
 *   <script src="/claudron-face.js"></script>
 *   renderFace(containerEl, 'happy');
 *
 * The container should be 200×183px (matching the sprite body dimensions)
 * with position: absolute or relative. The face elements are positioned
 * absolutely within it using pixel offsets calibrated to the sprite.
 *
 * Exports:
 *   window.renderFace(container, mood, options)
 *
 * Dependencies:
 *   None — vanilla JS, no external libraries.
 * ============================================================================
 */
(function(global) {
  'use strict';

  /** Whether CSS keyframe animations have been injected into <head>. */
  var stylesInjected = false;

  /**
   * Inject CSS keyframe animations for blinking, snoring, and ZzZ float.
   * Called once on first render; subsequent calls are no-ops.
   */
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.id = 'claudron-face-styles';
    style.textContent = [
      /* Blink: eyes squish to 10% height briefly */
      '@keyframes cf-blink { 0%,92%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }',
      /* Snore: mouth bubble grows and shrinks */
      '@keyframes cf-snore { 0%,100%{width:5px;height:5px} 50%{width:8px;height:8px} }',
      /* ZzZ: text floats up and fades in/out */
      '@keyframes cf-zzz { 0%,100%{opacity:0;transform:translate(0,0) scale(0.6)} 50%{opacity:1;transform:translate(10px,-20px) scale(1)} }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // =========================================================================
  //  Mood Definitions
  // =========================================================================

  /**
   * Mood config map. Each mood defines:
   *   eyeColor  — CSS color for eye dots (null = no eyes, e.g. sleeping)
   *   eyes      — 'normal' | 'side' | 'big' | 'closed'
   *   mouth     — 'smug' | 'smirk' | 'frown' | 'cat' | 'snore'
   *   brows     — 'none' | 'angry' | 'thinking'
   *   blush     — boolean, shows pink cheek marks
   */
  var MOODS = {
    happy:    { eyeColor: '#4ADE80', eyes: 'normal', mouth: 'smug',  brows: 'none',     blush: true  },
    thinking: { eyeColor: '#4ADE80', eyes: 'side',   mouth: 'smirk', brows: 'thinking', blush: false },
    sleeping: { eyeColor: null,      eyes: 'closed', mouth: 'snore', brows: 'none',     blush: false },
    angry:    { eyeColor: '#FF4444', eyes: 'normal', mouth: 'frown', brows: 'angry',    blush: false },
    excited:  { eyeColor: '#4ADE80', eyes: 'big',    mouth: 'cat',   brows: 'none',     blush: true  }
  };

  // =========================================================================
  //  DOM Helpers
  // =========================================================================

  /**
   * Create a DOM element with inline styles.
   * @param {string} tag - HTML tag name (e.g. 'div').
   * @param {object} styles - CSS property/value pairs.
   * @returns {HTMLElement} The created element.
   */
  function mk(tag, styles) {
    var el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
  }

  // =========================================================================
  //  Face Renderer
  // =========================================================================

  /**
   * Render Claudron's face expression into a container.
   * Clears the container and rebuilds all face elements from scratch.
   *
   * All pixel positions are calibrated for a 200×183px sprite body.
   * Eye positions: left eye ~115px, right eye ~141px from left edge.
   *
   * @param {HTMLElement} container - The face overlay element (200×183px).
   * @param {string} mood - One of: 'happy', 'thinking', 'sleeping', 'angry', 'excited'.
   * @param {object} [options] - Reserved for future use (e.g. scale).
   */
  function renderFace(container, mood, options) {
    if (!container) return;
    options = options || {};
    injectStyles();
    container.innerHTML = '';

    var m = MOODS[mood] || MOODS.happy;

    // --- Eyes ---
    if (m.eyes === 'normal' || m.eyes === 'side') {
      var shift = m.eyes === 'side' ? 'translateX(2px)' : 'none';
      [115, 141].forEach(function(left) {
        container.appendChild(mk('div', {
          position: 'absolute', top: '68px', left: left + 'px',
          width: '10px', height: '10px',
          background: m.eyeColor, borderRadius: '50%',
          boxShadow: '0 0 4px ' + m.eyeColor + ', 0 0 8px ' + m.eyeColor,
          animation: 'cf-blink 2s infinite', transformOrigin: 'center', transform: shift
        }));
      });
    } else if (m.eyes === 'big') {
      [114, 140].forEach(function(left) {
        container.appendChild(mk('div', {
          position: 'absolute', top: '68px', left: left + 'px',
          width: '12px', height: '12px',
          background: m.eyeColor, borderRadius: '50%',
          boxShadow: '0 0 4px ' + m.eyeColor + ', 0 0 8px ' + m.eyeColor,
          animation: 'cf-blink 2s infinite', transformOrigin: 'center'
        }));
      });
    } else if (m.eyes === 'closed') {
      [117, 139].forEach(function(left) {
        container.appendChild(mk('div', {
          position: 'absolute', top: '70px', left: left + 'px',
          width: '8px', height: '2px',
          background: '#C4B5FD', borderRadius: '1px'
        }));
      });
    }

    // --- Blush (pink cheek marks) ---
    if (m.blush) {
      [113, 141].forEach(function(left) {
        container.appendChild(mk('div', {
          position: 'absolute', top: '78px', left: left + 'px',
          width: '10px', height: '5px',
          background: 'rgba(255,100,140,0.55)', borderRadius: '50%',
          boxShadow: '0 0 4px rgba(255,100,140,0.3)'
        }));
      });
    }

    // --- Eyebrows ---
    if (m.brows === 'angry') {
      // Angled inward — left brow tilts down-right, right brow tilts down-left
      [[113, 15], [141, -15]].forEach(function(pair) {
        container.appendChild(mk('div', {
          position: 'absolute', top: '64px', left: pair[0] + 'px',
          width: '10px', height: '2px',
          background: '#FF4444', transform: 'rotate(' + pair[1] + 'deg)'
        }));
      });
    } else if (m.brows === 'thinking') {
      // Single raised right brow
      container.appendChild(mk('div', {
        position: 'absolute', top: '62px', left: '139px',
        width: '10px', height: '2px',
        background: '#C4B5FD', borderRadius: '1px', transform: 'rotate(-10deg)'
      }));
    }

    // --- Mouth ---
    if (m.mouth === 'smug') {
      // Small satisfied curve
      container.appendChild(mk('div', {
        position: 'absolute', top: '85px', left: '129px',
        width: '8px', height: '4px',
        borderBottom: '2px solid #C4B5FD', borderRadius: '0 0 5px 5px'
      }));
    } else if (m.mouth === 'smirk') {
      // Asymmetric half-smile
      container.appendChild(mk('div', {
        position: 'absolute', top: '85px', left: '130px',
        width: '6px', height: '3px',
        borderBottom: '2px solid #C4B5FD', borderRadius: '0 0 5px 1px'
      }));
    } else if (m.mouth === 'frown') {
      // Inverted curve
      container.appendChild(mk('div', {
        position: 'absolute', top: '87px', left: '130px',
        width: '6px', height: '3px',
        borderTop: '2px solid #FF6666', borderRadius: '5px 5px 0 0'
      }));
    } else if (m.mouth === 'cat') {
      // "ω" cat mouth via SVG path
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 12 6');
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '6');
      svg.style.cssText = 'position:absolute;top:83px;left:126px;';
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M0,1 Q3,6 6,1 Q9,6 12,1');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#C4B5FD');
      p.setAttribute('stroke-width', '1.5');
      p.setAttribute('stroke-linecap', 'round');
      svg.appendChild(p);
      container.appendChild(svg);
    } else if (m.mouth === 'snore') {
      // Breathing bubble that grows and shrinks
      container.appendChild(mk('div', {
        position: 'absolute', top: '84px', left: '131px',
        width: '5px', height: '5px',
        border: '2px solid #C4B5FD', borderRadius: '50%',
        animation: 'cf-snore 2.5s ease-in-out infinite'
      }));
    }

    // --- ZzZ floating text (sleeping only) ---
    if (mood === 'sleeping') {
      container.appendChild(mk('div', {
        position: 'absolute', top: '50px', right: '23px',
        color: '#A78BFA', fontSize: '14px', fontFamily: 'monospace',
        animation: 'cf-zzz 2s infinite'
      })).textContent = 'zZ';
    }
  }

  // Export to global scope
  global.renderFace = renderFace;

})(typeof window !== 'undefined' ? window : this);
