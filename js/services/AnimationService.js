/**
 * Servicio para efectos de transición y animaciones en el modo híbrido
 * Proporciona animaciones suaves, indicadores de carga y feedback visual
 */
export default {
  // Configuración de animaciones
  _config: {
    durations: {
      fast: 150,
      normal: 300,
      slow: 500
    },
    easings: {
      easeOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      easeIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
      easeInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    },
    enabled: true
  },

  // Estado de animaciones activas
  _activeAnimations: new Map(),
  _animationCounter: 0,

  /**
   * Inicializa el servicio de animaciones
   * @param {Object} options - Opciones de configuración
   */
  init(options = {}) {
    this._config = { ...this._config, ...options };
    this._setupGlobalStyles();
    this._detectReducedMotion();
  },

  /**
   * Habilita o deshabilita las animaciones
   * @param {Boolean} enabled - Si las animaciones deben estar habilitadas
   */
  setEnabled(enabled) {
    this._config.enabled = enabled;
    document.documentElement.style.setProperty('--animations-enabled', enabled ? '1' : '0');
  },

  /**
   * Verifica si las animaciones están habilitadas
   * @return {Boolean} true si están habilitadas
   */
  isEnabled() {
    return this._config.enabled;
  },

  /**
   * Anima la expansión/colapso de un elemento
   * @param {HTMLElement} element - Elemento a animar
   * @param {Boolean} expand - true para expandir, false para colapsar
   * @param {Object} options - Opciones de animación
   * @return {Promise} Promise que se resuelve cuando termina la animación
   */
  expandCollapse(element, expand, options = {}) {
    if (!this._config.enabled || !element) {
      return Promise.resolve();
    }

    const {
      duration = this._config.durations.normal,
      easing = this._config.easings.easeOut
    } = options;

    return new Promise((resolve) => {
      const animationId = this._getNextAnimationId();
      
      // Cancelar animación anterior si existe
      this._cancelAnimation(element);

      if (expand) {
        // Expandir
        element.style.height = 'auto';
        const targetHeight = element.scrollHeight;
        element.style.height = '0px';
        element.style.overflow = 'hidden';
        element.style.opacity = '0';

        // Forzar reflow
        element.offsetHeight;

        const animation = element.animate([
          { 
            height: '0px', 
            opacity: '0',
            transform: 'translateY(-10px)'
          },
          { 
            height: `${targetHeight}px`, 
            opacity: '1',
            transform: 'translateY(0)'
          }
        ], {
          duration,
          easing,
          fill: 'forwards'
        });

        this._activeAnimations.set(element, { animation, id: animationId });

        animation.addEventListener('finish', () => {
          element.style.height = 'auto';
          element.style.overflow = '';
          element.style.opacity = '';
          element.style.transform = '';
          this._activeAnimations.delete(element);
          resolve();
        });

      } else {
        // Colapsar
        const currentHeight = element.scrollHeight;
        element.style.height = `${currentHeight}px`;
        element.style.overflow = 'hidden';

        // Forzar reflow
        element.offsetHeight;

        const animation = element.animate([
          { 
            height: `${currentHeight}px`, 
            opacity: '1',
            transform: 'translateY(0)'
          },
          { 
            height: '0px', 
            opacity: '0',
            transform: 'translateY(-10px)'
          }
        ], {
          duration,
          easing,
          fill: 'forwards'
        });

        this._activeAnimations.set(element, { animation, id: animationId });

        animation.addEventListener('finish', () => {
          element.style.height = '';
          element.style.overflow = '';
          element.style.opacity = '';
          element.style.transform = '';
          this._activeAnimations.delete(element);
          resolve();
        });
      }
    });
  },

  /**
   * Anima el fade in/out de un elemento
   * @param {HTMLElement} element - Elemento a animar
   * @param {Boolean} fadeIn - true para fade in, false para fade out
   * @param {Object} options - Opciones de animación
   * @return {Promise} Promise que se resuelve cuando termina la animación
   */
  fade(element, fadeIn, options = {}) {
    if (!this._config.enabled || !element) {
      return Promise.resolve();
    }

    const {
      duration = this._config.durations.normal,
      easing = this._config.easings.easeInOut
    } = options;

    return new Promise((resolve) => {
      this._cancelAnimation(element);

      const fromOpacity = fadeIn ? '0' : '1';
      const toOpacity = fadeIn ? '1' : '0';

      const animation = element.animate([
        { opacity: fromOpacity },
        { opacity: toOpacity }
      ], {
        duration,
        easing,
        fill: 'forwards'
      });

      this._activeAnimations.set(element, { animation, id: this._getNextAnimationId() });

      animation.addEventListener('finish', () => {
        this._activeAnimations.delete(element);
        resolve();
      });
    });
  },

  /**
   * Anima el deslizamiento de un elemento
   * @param {HTMLElement} element - Elemento a animar
   * @param {String} direction - Dirección ('left', 'right', 'up', 'down')
   * @param {Boolean} slideIn - true para slide in, false para slide out
   * @param {Object} options - Opciones de animación
   * @return {Promise} Promise que se resuelve cuando termina la animación
   */
  slide(element, direction, slideIn, options = {}) {
    if (!this._config.enabled || !element) {
      return Promise.resolve();
    }

    const {
      duration = this._config.durations.normal,
      easing = this._config.easings.easeOut,
      distance = 100
    } = options;

    const transforms = {
      left: slideIn ? [`translateX(-${distance}px)`, 'translateX(0)'] : ['translateX(0)', `translateX(-${distance}px)`],
      right: slideIn ? [`translateX(${distance}px)`, 'translateX(0)'] : ['translateX(0)', `translateX(${distance}px)`],
      up: slideIn ? [`translateY(-${distance}px)`, 'translateY(0)'] : ['translateY(0)', `translateY(-${distance}px)`],
      down: slideIn ? [`translateY(${distance}px)`, 'translateY(0)'] : ['translateY(0)', `translateY(${distance}px)`]
    };

    return new Promise((resolve) => {
      this._cancelAnimation(element);

      const [fromTransform, toTransform] = transforms[direction] || transforms.left;

      const animation = element.animate([
        { 
          transform: fromTransform,
          opacity: slideIn ? '0' : '1'
        },
        { 
          transform: toTransform,
          opacity: slideIn ? '1' : '0'
        }
      ], {
        duration,
        easing,
        fill: 'forwards'
      });

      this._activeAnimations.set(element, { animation, id: this._getNextAnimationId() });

      animation.addEventListener('finish', () => {
        if (slideIn) {
          element.style.transform = '';
          element.style.opacity = '';
        }
        this._activeAnimations.delete(element);
        resolve();
      });
    });
  },

  /**
   * Anima un efecto de rebote en un elemento
   * @param {HTMLElement} element - Elemento a animar
   * @param {Object} options - Opciones de animación
   * @return {Promise} Promise que se resuelve cuando termina la animación
   */
  bounce(element, options = {}) {
    if (!this._config.enabled || !element) {
      return Promise.resolve();
    }

    const {
      duration = this._config.durations.fast,
      scale = 1.1
    } = options;

    return new Promise((resolve) => {
      this._cancelAnimation(element);

      const animation = element.animate([
        { transform: 'scale(1)' },
        { transform: `scale(${scale})` },
        { transform: 'scale(1)' }
      ], {
        duration,
        easing: this._config.easings.bounce,
        fill: 'forwards'
      });

      this._activeAnimations.set(element, { animation, id: this._getNextAnimationId() });

      animation.addEventListener('finish', () => {
        element.style.transform = '';
        this._activeAnimations.delete(element);
        resolve();
      });
    });
  },

  /**
   * Anima un efecto de pulso en un elemento
   * @param {HTMLElement} element - Elemento a animar
   * @param {Object} options - Opciones de animación
   * @return {Promise} Promise que se resuelve cuando termina la animación
   */
  pulse(element, options = {}) {
    if (!this._config.enabled || !element) {
      return Promise.resolve();
    }

    const {
      duration = this._config.durations.slow,
      iterations = 3,
      opacity = 0.5
    } = options;

    return new Promise((resolve) => {
      this._cancelAnimation(element);

      const animation = element.animate([
        { opacity: '1' },
        { opacity: opacity.toString() },
        { opacity: '1' }
      ], {
        duration: duration / iterations,
        iterations,
        easing: this._config.easings.easeInOut,
        fill: 'forwards'
      });

      this._activeAnimations.set(element, { animation, id: this._getNextAnimationId() });

      animation.addEventListener('finish', () => {
        element.style.opacity = '';
        this._activeAnimations.delete(element);
        resolve();
      });
    });
  },

  /**
   * Crea un indicador de carga animado
   * @param {HTMLElement} container - Contenedor donde mostrar el indicador
   * @param {Object} options - Opciones del indicador
   * @return {Object} Objeto con métodos para controlar el indicador
   */
  createLoadingIndicator(container, options = {}) {
    const {
      type = 'spinner', // 'spinner', 'dots', 'bar'
      size = 'medium', // 'small', 'medium', 'large'
      color = '#007bff',
      text = 'Cargando...'
    } = options;

    const loadingElement = document.createElement('div');
    loadingElement.className = `loading-indicator loading-${type} loading-${size}`;
    
    if (type === 'spinner') {
      loadingElement.innerHTML = `
        <div class="spinner" style="border-color: ${color}20; border-top-color: ${color};"></div>
        ${text ? `<div class="loading-text">${text}</div>` : ''}
      `;
    } else if (type === 'dots') {
      loadingElement.innerHTML = `
        <div class="dots">
          <div class="dot" style="background-color: ${color};"></div>
          <div class="dot" style="background-color: ${color};"></div>
          <div class="dot" style="background-color: ${color};"></div>
        </div>
        ${text ? `<div class="loading-text">${text}</div>` : ''}
      `;
    } else if (type === 'bar') {
      loadingElement.innerHTML = `
        <div class="progress-bar">
          <div class="progress-fill" style="background-color: ${color};"></div>
        </div>
        ${text ? `<div class="loading-text">${text}</div>` : ''}
      `;
    }

    container.appendChild(loadingElement);

    // Animar entrada
    this.fade(loadingElement, true, { duration: this._config.durations.fast });

    return {
      element: loadingElement,
      remove: () => {
        this.fade(loadingElement, false, { duration: this._config.durations.fast })
          .then(() => {
            if (loadingElement.parentNode) {
              loadingElement.parentNode.removeChild(loadingElement);
            }
          });
      },
      updateText: (newText) => {
        const textElement = loadingElement.querySelector('.loading-text');
        if (textElement) {
          textElement.textContent = newText;
        }
      }
    };
  },

  /**
   * Anima la transición entre estados de un elemento
   * @param {HTMLElement} element - Elemento a animar
   * @param {String} fromState - Estado inicial
   * @param {String} toState - Estado final
   * @param {Object} options - Opciones de animación
   * @return {Promise} Promise que se resuelve cuando termina la animación
   */
  stateTransition(element, fromState, toState, options = {}) {
    if (!this._config.enabled || !element) {
      return Promise.resolve();
    }

    const {
      duration = this._config.durations.normal,
      easing = this._config.easings.easeInOut
    } = options;

    return new Promise((resolve) => {
      this._cancelAnimation(element);

      // Remover estado anterior y añadir nuevo
      element.classList.remove(fromState);
      element.classList.add(toState);

      // Animar la transición
      const animation = element.animate([
        { opacity: '0.8', transform: 'scale(0.98)' },
        { opacity: '1', transform: 'scale(1)' }
      ], {
        duration,
        easing,
        fill: 'forwards'
      });

      this._activeAnimations.set(element, { animation, id: this._getNextAnimationId() });

      animation.addEventListener('finish', () => {
        this._activeAnimations.delete(element);
        resolve();
      });
    });
  },

  /**
   * Cancela todas las animaciones de un elemento
   * @param {HTMLElement} element - Elemento cuyas animaciones cancelar
   */
  cancelAnimations(element) {
    this._cancelAnimation(element);
  },

  /**
   * Cancela todas las animaciones activas
   */
  cancelAllAnimations() {
    this._activeAnimations.forEach(({ animation }) => {
      animation.cancel();
    });
    this._activeAnimations.clear();
  },

  /**
   * Configura estilos CSS globales para animaciones
   */
  _setupGlobalStyles() {
    const styleId = 'animation-service-styles';
    
    if (document.getElementById(styleId)) {
      return; // Ya existe
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      :root {
        --animations-enabled: ${this._config.enabled ? '1' : '0'};
      }

      .loading-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .loading-indicator.loading-small { font-size: 12px; }
      .loading-indicator.loading-medium { font-size: 14px; }
      .loading-indicator.loading-large { font-size: 16px; }

      .spinner {
        width: 2em;
        height: 2em;
        border: 2px solid;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .dots {
        display: flex;
        gap: 4px;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        animation: dot-bounce 1.4s ease-in-out infinite both;
      }

      .dot:nth-child(1) { animation-delay: -0.32s; }
      .dot:nth-child(2) { animation-delay: -0.16s; }

      .progress-bar {
        width: 100px;
        height: 4px;
        background-color: #f0f0f0;
        border-radius: 2px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        width: 30%;
        border-radius: 2px;
        animation: progress-slide 1.5s ease-in-out infinite;
      }

      .loading-text {
        margin-top: 10px;
        color: #666;
        font-size: 0.9em;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes dot-bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }

      @keyframes progress-slide {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(333%); }
      }

      @media (prefers-reduced-motion: reduce) {
        :root {
          --animations-enabled: 0;
        }
        
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;

    document.head.appendChild(style);
  },

  /**
   * Detecta si el usuario prefiere movimiento reducido
   */
  _detectReducedMotion() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.setEnabled(false);
    }

    // Escuchar cambios en la preferencia
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      mediaQuery.addEventListener('change', (e) => {
        this.setEnabled(!e.matches);
      });
    }
  },

  /**
   * Cancela la animación de un elemento específico
   * @param {HTMLElement} element - Elemento cuya animación cancelar
   */
  _cancelAnimation(element) {
    const activeAnimation = this._activeAnimations.get(element);
    if (activeAnimation) {
      activeAnimation.animation.cancel();
      this._activeAnimations.delete(element);
    }
  },

  /**
   * Obtiene el siguiente ID de animación
   * @return {Number} ID único de animación
   */
  _getNextAnimationId() {
    return ++this._animationCounter;
  },

  /**
   * Obtiene estadísticas de animaciones activas
   * @return {Object} Estadísticas de animaciones
   */
  getStats() {
    return {
      activeAnimations: this._activeAnimations.size,
      enabled: this._config.enabled,
      totalAnimations: this._animationCounter
    };
  }
};