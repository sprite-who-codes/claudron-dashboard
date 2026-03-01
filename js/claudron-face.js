/**
 * ============================================================================
 * File:     dashboard/js/claudron-face.js
 * Purpose:  Composition-Based Face Rendering for Claudron's Sprite
 *
 * Renders Claudron's facial expression using a rich emotion palette built
 * from composable feature dimensions. Each emotion is a "recipe" combining:
 *   eyeSize, eyeColor, eyeGlow, pupilShift, blinkRate,
 *   mouthType, browType, blush, bodyAnim
 *
 * Usage:
 *   renderFace(containerEl, 'happy');
 *   renderFace(containerEl, 'curious');
 *   renderFace(containerEl, { eyeSize:'big', eyeColor:'#FFD700', ... });
 *
 * The container should be 200×183px with position: absolute or relative.
 *
 * Exports:
 *   window.renderFace(container, mood, options)  — main API
 *   window.EMOTION_RECIPES                        — emotion definitions
 *
 * Dependencies: None — vanilla JS.
 * ============================================================================
 */
(function(global) {
  'use strict';

  var stylesInjected = false;

  // =========================================================================
  //  CSS Injection — all animations for face features
  // =========================================================================

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.id = 'claudron-face-styles';
    style.textContent = [
      // Blink animations at different rates
      '@keyframes cf-blink-normal { 0%,92%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }',
      '@keyframes cf-blink-slow { 0%,90%,100%{transform:scaleY(1)} 94%{transform:scaleY(0.1)} }',
      '@keyframes cf-blink-fast { 0%,85%,100%{transform:scaleY(1)} 90%{transform:scaleY(0.1)} }',

      // Snore bubble
      '@keyframes cf-snore { 0%,100%{width:5px;height:5px} 50%{width:8px;height:8px} }',

      // ZzZ float
      '@keyframes cf-zzz { 0%,100%{opacity:0;transform:translate(0,0) scale(0.6)} 50%{opacity:1;transform:translate(10px,-20px) scale(1)} }',

      // Eye glow: pulsing
      '@keyframes cf-glow-pulse { 0%,100%{opacity:1;filter:brightness(1)} 50%{opacity:0.7;filter:brightness(1.4)} }',

      // Eye glow: flickering
      '@keyframes cf-glow-flicker { 0%{opacity:1} 10%{opacity:0.4} 20%{opacity:1} 30%{opacity:0.6} 50%{opacity:1} 60%{opacity:0.3} 70%{opacity:0.9} 80%{opacity:0.5} 90%{opacity:1} 100%{opacity:0.7} }',

      // Mouth wobble
      '@keyframes cf-wobble { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-1px)} 75%{transform:translateX(1px)} }',

      // Body animations (applied to sprite container via class)
      '@keyframes cf-body-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }',
      '@keyframes cf-body-shrink { 0%,100%{transform:scale(1)} 50%{transform:scale(0.95)} }',
      '@keyframes cf-body-vibrate { 0%{transform:translateX(0)} 25%{transform:translateX(-2px)} 50%{transform:translateX(2px)} 75%{transform:translateX(-1px)} 100%{transform:translateX(0)} }',
      '@keyframes cf-body-sway { 0%,100%{transform:rotate(0deg)} 25%{transform:rotate(-1deg)} 75%{transform:rotate(1deg)} }',
      '@keyframes cf-body-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }',

      // Body animation classes
      '.cf-body-bounce { animation: cf-body-bounce 0.6s ease-in-out infinite !important; }',
      '.cf-body-shrink { animation: cf-body-shrink 2s ease-in-out infinite !important; }',
      '.cf-body-vibrate { animation: cf-body-vibrate 0.15s linear infinite !important; }',
      '.cf-body-sway { animation: cf-body-sway 3s ease-in-out infinite !important; }',
      '.cf-body-float { animation: cf-body-float 3s ease-in-out infinite !important; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // =========================================================================
  //  Emotion Recipes
  // =========================================================================

  var EMOTION_RECIPES = {
    // --- Original 5 (preserved behavior) ---
    happy:       { eyeSize:'normal', eyeColor:'#4ADE80', eyeGlow:'bright', pupilShift:'center', blinkRate:'normal', mouthType:'smug',  browType:'none',     blush:'light', bodyAnim:'none' },
    thinking:    { eyeSize:'normal', eyeColor:'#4ADE80', eyeGlow:'bright', pupilShift:'right',  blinkRate:'normal', mouthType:'smirk', browType:'thinking', blush:'none',  bodyAnim:'none' },
    sleeping:    { eyeSize:'normal', eyeColor:null,      eyeGlow:'off',    pupilShift:'center', blinkRate:'none',   mouthType:'snore', browType:'none',     blush:'none',  bodyAnim:'none' },
    angry:       { eyeSize:'normal', eyeColor:'#FF4444', eyeGlow:'bright', pupilShift:'center', blinkRate:'normal', mouthType:'frown', browType:'angry',    blush:'none',  bodyAnim:'none' },
    excited:     { eyeSize:'big',    eyeColor:'#4ADE80', eyeGlow:'bright', pupilShift:'center', blinkRate:'normal', mouthType:'cat',   browType:'none',     blush:'light', bodyAnim:'bounce' },

    // --- New emotions ---
    curious:     { eyeSize:'big',    eyeColor:'#4ADE80', eyeGlow:'pulsing',    pupilShift:'up',     blinkRate:'slow',   mouthType:'small-o',browType:'raised-both', blush:'none',  bodyAnim:'none' },
    proud:       { eyeSize:'big',    eyeColor:'#FFD700', eyeGlow:'bright',     pupilShift:'center', blinkRate:'slow',   mouthType:'grin',   browType:'raised-both', blush:'light', bodyAnim:'float' },
    mischievous: { eyeSize:'normal', eyeColor:'#4ADE80', eyeGlow:'bright',     pupilShift:'left',   blinkRate:'normal', mouthType:'cat',    browType:'thinking',    blush:'light', bodyAnim:'none' },
    cozy:        { eyeSize:'normal', eyeColor:'#4ADE80', eyeGlow:'dim',        pupilShift:'center', blinkRate:'slow',   mouthType:'smug',   browType:'none',        blush:'light', bodyAnim:'sway' },
    grateful:    { eyeSize:'big',    eyeColor:'#FFD700', eyeGlow:'dim',        pupilShift:'center', blinkRate:'slow',   mouthType:'smug',   browType:'none',        blush:'heavy', bodyAnim:'none' },
    vulnerable:  { eyeSize:'big',    eyeColor:'#4ADE80', eyeGlow:'dim',        pupilShift:'down',   blinkRate:'fast',   mouthType:'wobble', browType:'worried',     blush:'heavy', bodyAnim:'shrink' },
    overwhelmed: { eyeSize:'tiny',   eyeColor:'#60A5FA', eyeGlow:'flickering', pupilShift:'center', blinkRate:'fast',   mouthType:'flat',   browType:'furrowed',    blush:'none',  bodyAnim:'vibrate' },
    lonely:      { eyeSize:'normal', eyeColor:'#C4B5FD', eyeGlow:'dim',        pupilShift:'down',   blinkRate:'slow',   mouthType:'flat',   browType:'none',        blush:'none',  bodyAnim:'none' },
    embarrassed: { eyeSize:'normal', eyeColor:'#4ADE80', eyeGlow:'bright',     pupilShift:'left',   blinkRate:'fast',   mouthType:'wobble', browType:'worried',     blush:'heavy', bodyAnim:'shrink' },
    protective:  { eyeSize:'normal', eyeColor:'#FF4444', eyeGlow:'bright',     pupilShift:'center', blinkRate:'none',   mouthType:'flat',   browType:'furrowed',    blush:'none',  bodyAnim:'none' },
    awe:         { eyeSize:'wide',   eyeColor:'#FFD700', eyeGlow:'pulsing',    pupilShift:'up',     blinkRate:'none',   mouthType:'open',   browType:'raised-both', blush:'light', bodyAnim:'float' },
    jealous:     { eyeSize:'normal', eyeColor:'#4ADE80', eyeGlow:'dim',        pupilShift:'left',   blinkRate:'normal', mouthType:'frown',  browType:'furrowed',    blush:'none',  bodyAnim:'none' },
    defiant:     { eyeSize:'normal', eyeColor:'#FF4444', eyeGlow:'bright',     pupilShift:'center', blinkRate:'none',   mouthType:'smirk',  browType:'angry',       blush:'none',  bodyAnim:'none' }
  };

  // =========================================================================
  //  DOM Helper
  // =========================================================================

  function mk(tag, styles) {
    var el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
  }

  // =========================================================================
  //  Feature Renderers
  // =========================================================================

  /** Eye size → pixel dimensions. Returns {w, h, leftPositions, top, borderRadius} */
  function getEyeMetrics(eyeSize) {
    switch (eyeSize) {
      case 'tiny':   return { w: 6,  h: 6,  positions: [117, 143], top: 70, radius: '50%' };
      case 'big':    return { w: 12, h: 12, positions: [114, 140], top: 68, radius: '50%' };
      case 'wide':   return { w: 14, h: 11, positions: [113, 140], top: 68, radius: '50%' };
      default:       return { w: 10, h: 10, positions: [115, 141], top: 68, radius: '50%' };
    }
  }

  /** Pupil shift → CSS transform string */
  function getPupilTransform(shift) {
    switch (shift) {
      case 'left':  return 'translateX(-2px)';
      case 'right': return 'translateX(2px)';
      case 'up':    return 'translateY(-2px)';
      case 'down':  return 'translateY(2px)';
      default:      return 'none';
    }
  }

  /** Eye glow → box-shadow and animation */
  function getGlowStyles(color, glow) {
    var shadow;
    switch (glow) {
      case 'bright':     shadow = '0 0 4px ' + color + ', 0 0 8px ' + color; break;
      case 'dim':        shadow = '0 0 2px ' + color; break;
      case 'pulsing':    shadow = '0 0 4px ' + color + ', 0 0 8px ' + color; break;
      case 'flickering': shadow = '0 0 4px ' + color + ', 0 0 8px ' + color; break;
      default:           shadow = 'none'; break;
    }
    var anim = '';
    if (glow === 'pulsing') anim = 'cf-glow-pulse 2s ease-in-out infinite';
    if (glow === 'flickering') anim = 'cf-glow-flicker 0.8s steps(1) infinite';
    return { boxShadow: shadow, animation: anim };
  }

  /** Blink rate → animation string (combined with glow anim) */
  function getBlinkAnim(rate) {
    switch (rate) {
      case 'slow':   return 'cf-blink-slow 4s infinite';
      case 'fast':   return 'cf-blink-fast 0.8s infinite';
      case 'none':   return '';
      default:       return 'cf-blink-normal 2s infinite';
    }
  }

  // =========================================================================
  //  Main Renderer
  // =========================================================================

  /**
   * Render Claudron's face into a container.
   *
   * @param {HTMLElement} container - 200×183px face overlay element.
   * @param {string|object} mood - Emotion name or custom recipe object.
   * @param {object} [options] - Reserved for future use.
   * @returns {object} - { bodyAnim: string } for the caller to apply.
   */
  function renderFace(container, mood, options) {
    if (!container) return { bodyAnim: 'none' };
    injectStyles();
    container.innerHTML = '';

    // Resolve recipe
    var recipe;
    if (typeof mood === 'object' && mood !== null) {
      recipe = mood;
    } else {
      recipe = EMOTION_RECIPES[mood] || EMOTION_RECIPES.happy;
    }

    var r = recipe;

    // --- Eyes ---
    if (r.eyeColor && r.eyeGlow !== 'off') {
      var metrics = getEyeMetrics(r.eyeSize);
      var transform = getPupilTransform(r.pupilShift);
      var glowStyles = getGlowStyles(r.eyeColor, r.eyeGlow);
      var blinkAnim = getBlinkAnim(r.blinkRate);

      // Combine animations: blink + glow
      var anims = [];
      if (blinkAnim) anims.push(blinkAnim);
      if (glowStyles.animation) anims.push(glowStyles.animation);
      var combinedAnim = anims.join(', ') || 'none';

      metrics.positions.forEach(function(left) {
        container.appendChild(mk('div', {
          position: 'absolute',
          top: metrics.top + 'px',
          left: left + 'px',
          width: metrics.w + 'px',
          height: metrics.h + 'px',
          background: r.eyeColor,
          borderRadius: metrics.radius,
          boxShadow: glowStyles.boxShadow,
          animation: combinedAnim,
          transformOrigin: 'center',
          transform: transform
        }));
      });
    } else if (r.eyeGlow === 'off') {
      // Closed eyes (sleeping)
      [117, 139].forEach(function(left) {
        container.appendChild(mk('div', {
          position: 'absolute', top: '70px', left: left + 'px',
          width: '8px', height: '2px',
          background: '#C4B5FD', borderRadius: '1px'
        }));
      });
    }

    // --- Blush ---
    if (r.blush && r.blush !== 'none') {
      var opacity = r.blush === 'heavy' ? 0.75 : 0.55;
      var spread = r.blush === 'heavy' ? '0 0 6px rgba(255,100,140,0.5)' : '0 0 4px rgba(255,100,140,0.3)';
      [113, 141].forEach(function(left) {
        container.appendChild(mk('div', {
          position: 'absolute', top: '78px', left: left + 'px',
          width: '10px', height: '5px',
          background: 'rgba(255,100,140,' + opacity + ')',
          borderRadius: '50%',
          boxShadow: spread
        }));
      });
    }

    // --- Eyebrows ---
    renderBrows(container, r.browType, r.eyeColor);

    // --- Mouth ---
    renderMouth(container, r.mouthType);

    // --- ZzZ (sleeping) ---
    if (r.mouthType === 'snore') {
      container.appendChild(mk('div', {
        position: 'absolute', top: '50px', right: '23px',
        color: '#A78BFA', fontSize: '14px', fontFamily: 'monospace',
        animation: 'cf-zzz 2s infinite'
      })).textContent = 'zZ';
    }

    // --- Body animation ---
    var bodyAnim = r.bodyAnim || 'none';

    // Apply body animation class to sprite container if we can find it
    var spriteWrap = container.closest('#sprite-wrap') ||
                     (container.parentElement && container.parentElement.querySelector('#sprite-wrap'));
    if (!spriteWrap && container.parentElement) {
      spriteWrap = container.parentElement;
    }

    // Set data attribute for external consumers
    container.dataset.bodyAnim = bodyAnim;

    // Apply/remove body animation classes on the anchor (parent of sprite-wrap)
    var spriteAnchor = document.getElementById('sprite-anchor');
    if (spriteAnchor) {
      // Remove all cf-body-* classes
      spriteAnchor.className = spriteAnchor.className.replace(/\bcf-body-\S+/g, '').trim();
      if (bodyAnim !== 'none') {
        spriteAnchor.classList.add('cf-body-' + bodyAnim);
      }
    }

    return { bodyAnim: bodyAnim };
  }

  // =========================================================================
  //  Brow Renderer
  // =========================================================================

  function renderBrows(container, browType, eyeColor) {
    if (!browType || browType === 'none') return;

    var browColor = '#C4B5FD'; // default lavender

    switch (browType) {
      case 'angry':
        browColor = '#FF4444';
        [[113, 15], [141, -15]].forEach(function(pair) {
          container.appendChild(mk('div', {
            position: 'absolute', top: '64px', left: pair[0] + 'px',
            width: '10px', height: '2px',
            background: browColor, transform: 'rotate(' + pair[1] + 'deg)'
          }));
        });
        break;

      case 'thinking':
        container.appendChild(mk('div', {
          position: 'absolute', top: '62px', left: '139px',
          width: '10px', height: '2px',
          background: browColor, borderRadius: '1px', transform: 'rotate(-10deg)'
        }));
        break;

      case 'worried':
        // Both brows angled up-outward (concerned)
        [[113, -12], [141, 12]].forEach(function(pair) {
          container.appendChild(mk('div', {
            position: 'absolute', top: '63px', left: pair[0] + 'px',
            width: '10px', height: '2px',
            background: browColor, transform: 'rotate(' + pair[1] + 'deg)'
          }));
        });
        break;

      case 'raised-both':
        // Both brows raised high
        [113, 141].forEach(function(left) {
          container.appendChild(mk('div', {
            position: 'absolute', top: '61px', left: left + 'px',
            width: '10px', height: '2px',
            background: browColor, borderRadius: '1px'
          }));
        });
        break;

      case 'furrowed':
        // Both brows angled inward slightly (tense, focused)
        [[113, 8], [141, -8]].forEach(function(pair) {
          container.appendChild(mk('div', {
            position: 'absolute', top: '64px', left: pair[0] + 'px',
            width: '10px', height: '2px',
            background: browColor, transform: 'rotate(' + pair[1] + 'deg)'
          }));
        });
        break;
    }
  }

  // =========================================================================
  //  Mouth Renderer
  // =========================================================================

  function renderMouth(container, mouthType) {
    switch (mouthType) {
      case 'smug':
        container.appendChild(mk('div', {
          position: 'absolute', top: '85px', left: '129px',
          width: '8px', height: '4px',
          borderBottom: '2px solid #C4B5FD', borderRadius: '0 0 5px 5px'
        }));
        break;

      case 'smirk':
        container.appendChild(mk('div', {
          position: 'absolute', top: '85px', left: '130px',
          width: '6px', height: '3px',
          borderBottom: '2px solid #C4B5FD', borderRadius: '0 0 5px 1px'
        }));
        break;

      case 'frown':
        container.appendChild(mk('div', {
          position: 'absolute', top: '87px', left: '130px',
          width: '6px', height: '3px',
          borderTop: '2px solid #FF6666', borderRadius: '5px 5px 0 0'
        }));
        break;

      case 'cat':
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
        break;

      case 'snore':
        container.appendChild(mk('div', {
          position: 'absolute', top: '84px', left: '131px',
          width: '5px', height: '5px',
          border: '2px solid #C4B5FD', borderRadius: '50%',
          animation: 'cf-snore 2.5s ease-in-out infinite'
        }));
        break;

      case 'grin':
        // Wider than smug — big satisfied curve
        container.appendChild(mk('div', {
          position: 'absolute', top: '84px', left: '126px',
          width: '12px', height: '5px',
          borderBottom: '2px solid #C4B5FD', borderRadius: '0 0 6px 6px'
        }));
        break;

      case 'flat':
        // Straight horizontal line
        container.appendChild(mk('div', {
          position: 'absolute', top: '87px', left: '129px',
          width: '8px', height: '2px',
          background: '#C4B5FD', borderRadius: '1px'
        }));
        break;

      case 'open':
        // Small oval — surprise/awe
        container.appendChild(mk('div', {
          position: 'absolute', top: '84px', left: '129px',
          width: '8px', height: '6px',
          border: '2px solid #C4B5FD', borderRadius: '50%',
          background: 'rgba(196,181,253,0.15)'
        }));
        break;

      case 'small-o':
        // Tiny circle — curiosity
        container.appendChild(mk('div', {
          position: 'absolute', top: '85px', left: '130px',
          width: '5px', height: '5px',
          border: '1.5px solid #C4B5FD', borderRadius: '50%'
        }));
        break;

      case 'wobble':
        // Trembling flat mouth
        container.appendChild(mk('div', {
          position: 'absolute', top: '87px', left: '128px',
          width: '8px', height: '2px',
          background: '#C4B5FD', borderRadius: '1px',
          animation: 'cf-wobble 0.3s ease-in-out infinite'
        }));
        break;
    }
  }

  // =========================================================================
  //  Exports
  // =========================================================================

  global.renderFace = renderFace;
  global.EMOTION_RECIPES = EMOTION_RECIPES;

})(typeof window !== 'undefined' ? window : this);
