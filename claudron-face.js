/**
 * Claudron Face Renderer — shared vanilla JS module
 * Usage: renderFace(container, mood, { scale: 1 })
 * Container should be 200x183px, position:relative or absolute
 */
(function(global) {
  'use strict';

  var stylesInjected = false;

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.id = 'claudron-face-styles';
    style.textContent = [
      '@keyframes cf-blink { 0%,92%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }',
      '@keyframes cf-snore { 0%,100%{width:5px;height:5px} 50%{width:8px;height:8px} }',
      '@keyframes cf-zzz { 0%,100%{opacity:0;transform:translate(0,0) scale(0.6)} 50%{opacity:1;transform:translate(10px,-20px) scale(1)} }'
    ].join('\n');
    document.head.appendChild(style);
  }

  var MOODS = {
    happy:    { eyeColor:'#4ADE80', eyes:'normal', mouth:'smug',  brows:'none',     blush:true },
    thinking: { eyeColor:'#4ADE80', eyes:'side',   mouth:'smirk', brows:'thinking', blush:false },
    sleeping: { eyeColor:null,      eyes:'closed', mouth:'snore', brows:'none',     blush:false },
    angry:    { eyeColor:'#FF4444', eyes:'normal', mouth:'frown', brows:'angry',    blush:false },
    excited:  { eyeColor:'#4ADE80', eyes:'big',    mouth:'cat',   brows:'none',     blush:true }
  };

  function mk(tag, styles) {
    var el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
  }

  function renderFace(container, mood, options) {
    if (!container) return;
    options = options || {};
    injectStyles();
    container.innerHTML = '';

    var m = MOODS[mood] || MOODS.happy;

    // Eyes
    if (m.eyes === 'normal' || m.eyes === 'side') {
      var shift = m.eyes === 'side' ? 'translateX(2px)' : 'none';
      [115, 141].forEach(function(left) {
        container.appendChild(mk('div', {
          position:'absolute', top:'68px', left:left+'px', width:'10px', height:'10px',
          background:m.eyeColor, borderRadius:'50%',
          boxShadow:'0 0 4px '+m.eyeColor+', 0 0 8px '+m.eyeColor,
          animation:'cf-blink 2s infinite', transformOrigin:'center', transform:shift
        }));
      });
    } else if (m.eyes === 'big') {
      [114, 140].forEach(function(left) {
        container.appendChild(mk('div', {
          position:'absolute', top:'68px', left:left+'px', width:'12px', height:'12px',
          background:m.eyeColor, borderRadius:'50%',
          boxShadow:'0 0 4px '+m.eyeColor+', 0 0 8px '+m.eyeColor,
          animation:'cf-blink 2s infinite', transformOrigin:'center'
        }));
      });
    } else if (m.eyes === 'closed') {
      [117, 139].forEach(function(left) {
        container.appendChild(mk('div', {
          position:'absolute', top:'70px', left:left+'px', width:'8px', height:'2px',
          background:'#C4B5FD', borderRadius:'1px'
        }));
      });
    }

    // Blush
    if (m.blush) {
      [113, 141].forEach(function(left) {
        container.appendChild(mk('div', {
          position:'absolute', top:'78px', left:left+'px', width:'10px', height:'5px',
          background:'rgba(255,100,140,0.55)', borderRadius:'50%',
          boxShadow:'0 0 4px rgba(255,100,140,0.3)'
        }));
      });
    }

    // Brows
    if (m.brows === 'angry') {
      [[113, 15], [141, -15]].forEach(function(pair) {
        container.appendChild(mk('div', {
          position:'absolute', top:'64px', left:pair[0]+'px', width:'10px', height:'2px',
          background:'#FF4444', transform:'rotate('+pair[1]+'deg)'
        }));
      });
    } else if (m.brows === 'thinking') {
      container.appendChild(mk('div', {
        position:'absolute', top:'62px', left:'139px', width:'10px', height:'2px',
        background:'#C4B5FD', borderRadius:'1px', transform:'rotate(-10deg)'
      }));
    }

    // Mouth
    if (m.mouth === 'smug') {
      container.appendChild(mk('div', {
        position:'absolute', top:'85px', left:'129px', width:'8px', height:'4px',
        borderBottom:'2px solid #C4B5FD', borderRadius:'0 0 5px 5px'
      }));
    } else if (m.mouth === 'smirk') {
      container.appendChild(mk('div', {
        position:'absolute', top:'85px', left:'130px', width:'6px', height:'3px',
        borderBottom:'2px solid #C4B5FD', borderRadius:'0 0 5px 1px'
      }));
    } else if (m.mouth === 'frown') {
      container.appendChild(mk('div', {
        position:'absolute', top:'87px', left:'130px', width:'6px', height:'3px',
        borderTop:'2px solid #FF6666', borderRadius:'5px 5px 0 0'
      }));
    } else if (m.mouth === 'cat') {
      var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 12 6');
      svg.setAttribute('width','12');
      svg.setAttribute('height','6');
      svg.style.cssText = 'position:absolute;top:83px;left:126px;';
      var path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d','M0,1 Q3,6 6,1 Q9,6 12,1');
      path.setAttribute('fill','none');
      path.setAttribute('stroke','#C4B5FD');
      path.setAttribute('stroke-width','1.5');
      path.setAttribute('stroke-linecap','round');
      svg.appendChild(path);
      container.appendChild(svg);
    } else if (m.mouth === 'snore') {
      container.appendChild(mk('div', {
        position:'absolute', top:'84px', left:'131px', width:'5px', height:'5px',
        border:'2px solid #C4B5FD', borderRadius:'50%', animation:'cf-snore 2.5s ease-in-out infinite'
      }));
    }

    // ZzZ
    if (mood === 'sleeping') {
      container.appendChild(mk('div', {
        position:'absolute', top:'50px', right:'23px', color:'#A78BFA',
        fontSize:'14px', fontFamily:'monospace', animation:'cf-zzz 2s infinite'
      })).textContent = 'zZ';
    }
  }

  global.renderFace = renderFace;

})(typeof window !== 'undefined' ? window : this);
