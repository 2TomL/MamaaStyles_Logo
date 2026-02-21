import * as THREE from "https://esm.sh/three@0.175.0";

class App {
  constructor() {
    this.settings = {
      damping: 0.98,
      tension: 0.02,
      resolution: 512,
      rippleStrength: 1.0,
      mouseIntensity: 0.3,
      clickIntensity: 2.0,
      rippleRadius: 20,
      autoDrops: true,
      autoDropInterval: 3000,
      autoDropIntensity: 1.0,
      performanceMode: true
    };

    this.gradientColors = {
      // Donker paars en oranje-paars tinten
      colorA1: [0.18, 0.04, 0.22],   // diep donkerpaars
      colorA2: [0.10, 0.01, 0.13],   // bijna zwart-paars
      colorB1: [0.55, 0.22, 0.18],   // oranje-paars (warme gloed)
      colorB2: [0.32, 0.08, 0.18]    // donker oranje-paars
    };

    this.lastMousePosition = { x: 0, y: 0 };
    this.mouseThrottleTime = 0;
    this.loadingProgress = 0;
    this.isLoaded = false;

    this.startLoading();
  }

  exposeInstance() {
    window.AppInstance = this;
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -window.innerWidth / 2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      -window.innerHeight / 2,
      0.1,
      1000
    );
    this.camera.position.z = 10;

    this.clock = new THREE.Clock();

    this.initWaterRipple();
    this.createBackground();
    this.createGlowingRing(); // new animated glowing tube around logo
    this.bindEvents();
    this.setupAutoDrops();
    this.tick();
  }

  startLoading() {
    const progressBar = document.getElementById("progress-bar");
    const progressPercentage = document.getElementById("progress-percentage");
    const loader = document.getElementById("loader");

    const loadingInterval = setInterval(() => {
      this.loadingProgress += Math.random() * 3 + 1;

      if (this.loadingProgress >= 100) {
        this.loadingProgress = 100;
        clearInterval(loadingInterval);

        progressBar.style.width = "100%";
        progressPercentage.textContent = "100%";

        setTimeout(() => {
          this.init();

          setTimeout(() => {
            loader.classList.add("hidden");
            this.isLoaded = true;
            this.exposeInstance();
            // Start logo drop pas NA loader
            setTimeout(triggerLogoDropAndRipple, 400);
          }, 500);
        }, 300);
      // Logo animatie en ripple trigger NA loader
      function triggerLogoDropAndRipple() {
        const logo = document.getElementById("logo-shield");
        const wrapper = document.getElementById("logo-wrapper");
        if (!logo) return;
        logo.classList.add("dropping");
        if (wrapper) wrapper.classList.add("dropping");
        // Wacht tot animatie klaar is (1.6s), dan ripple
        setTimeout(() => {
          // Bepaal het middelpunt van de onderkant van het logo
          const rect = logo.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const bottomY = rect.bottom;
          // Wacht tot App geladen is
          if (window.AppInstance && window.AppInstance.isLoaded) {
            window.AppInstance.addRipple(centerX, bottomY, 2.2);
          } else {
            // Probeer opnieuw als App nog niet klaar is
            let tries = 0;
            const tryRipple = () => {
              if (window.AppInstance && window.AppInstance.isLoaded) {
                window.AppInstance.addRipple(centerX, bottomY, 2.2);
              } else if (tries < 20) {
                tries++;
                setTimeout(tryRipple, 200);
              }
            };
            tryRipple();
          }
          // Start fiery outline direct na logo-drop
          if (window.triggerFieryOutline) {
            window.triggerFieryOutline();
          }
        }, 1700);
      }
      } else {
        progressBar.style.width = this.loadingProgress + "%";
        progressPercentage.textContent = Math.floor(this.loadingProgress) + "%";
      }
    }, 50);
      // Custom color for progress < 10%
      const origSetWidth = progressBar.style.width;
      const origBg = progressBar.style.background;
      const updateBarColor = () => {
        if (this.loadingProgress < 10) {
          progressBar.style.background = "linear-gradient(90deg, #ff4de3 0%, #fff0b3 100%)";
        } else {
          progressBar.style.background = "linear-gradient(90deg, #ff4de3 0%, #fff0b3 100%)";
        }
      };
      setInterval(updateBarColor, 50);
  }

  initWaterRipple() {
    const resolution = this.settings.resolution;

    this.waterBuffers = {
      current: new Float32Array(resolution * resolution),
      previous: new Float32Array(resolution * resolution)
    };

    this.waterTexture = new THREE.DataTexture(
      this.waterBuffers.current,
      resolution,
      resolution,
      THREE.RedFormat,
      THREE.FloatType
    );
    this.waterTexture.minFilter = THREE.LinearFilter;
    this.waterTexture.magFilter = THREE.LinearFilter;
    this.waterTexture.needsUpdate = true;
  }

  createBackground() {
    const backgroundShader = {
      uniforms: {
        waterTexture: { value: this.waterTexture },
        rippleStrength: { value: this.settings.rippleStrength },
        resolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight)
        },
        time: { value: 0 },
        colorA1: {
          value: new THREE.Vector3(
            this.gradientColors.colorA1[0],
            this.gradientColors.colorA1[1],
            this.gradientColors.colorA1[2]
          )
        },
        colorA2: {
          value: new THREE.Vector3(
            this.gradientColors.colorA2[0],
            this.gradientColors.colorA2[1],
            this.gradientColors.colorA2[2]
          )
        },
        colorB1: {
          value: new THREE.Vector3(
            this.gradientColors.colorB1[0],
            this.gradientColors.colorB1[1],
            this.gradientColors.colorB1[2]
          )
        },
        colorB2: {
          value: new THREE.Vector3(
            this.gradientColors.colorB2[0],
            this.gradientColors.colorB2[1],
            this.gradientColors.colorB2[2]
          )
        }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D waterTexture;
        uniform float rippleStrength;
        uniform vec2 resolution;
        uniform float time;
        uniform vec3 colorA1;
        uniform vec3 colorA2;
        uniform vec3 colorB1;
        uniform vec3 colorB2;
        varying vec2 vUv;
        float S(float a, float b, float t) {
          return smoothstep(a, b, t);
        }
        mat2 Rot(float a) {
          float s = sin(a);
          float c = cos(a);
          return mat2(c, -s, s, c);
        }
        float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 fp = fract(p);
          float a = fract(sin(dot(ip, vec2(12.9898, 78.233))) * 43758.5453);
          float b = fract(sin(dot(ip + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
          float c = fract(sin(dot(ip + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
          float d = fract(sin(dot(ip + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
          fp = fp * fp * (3.0 - 2.0 * fp);
          return mix(mix(a, b, fp.x), mix(c, d, fp.x), fp.y);
        }
        void main() {
          float waterHeight = texture2D(waterTexture, vUv).r;
          float step = 1.0 / resolution.x;
          vec2 distortion = vec2(
            texture2D(waterTexture, vec2(vUv.x + step, vUv.y)).r - texture2D(waterTexture, vec2(vUv.x - step, vUv.y)).r,
            texture2D(waterTexture, vec2(vUv.x, vUv.y + step)).r - texture2D(waterTexture, vec2(vUv.x, vUv.y - step)).r
          ) * rippleStrength * 5.0;
          vec2 tuv = vUv + distortion;
          tuv -= 0.5;
          float ratio = resolution.x / resolution.y;
          tuv.y *= 1.0/ratio;
          vec3 layer1 = mix(colorA1, colorA2, S(-0.3, 0.2, (tuv*Rot(radians(-5.0))).x));
          vec3 layer2 = mix(colorB1, colorB2, S(-0.3, 0.2, (tuv*Rot(radians(-5.0))).x));
          vec3 finalComp = mix(layer1, layer2, S(0.5, -0.3, tuv.y));
          float noiseValue = noise(tuv * 20.0 + time * 0.1) * 0.03;
          finalComp += vec3(noiseValue);
          float vignette = 1.0 - smoothstep(0.5, 1.5, length(tuv * 1.5));
          finalComp *= mix(0.95, 1.0, vignette);
          gl_FragColor = vec4(finalComp, 1.0);
        }
      `
    };
    const geometry = new THREE.PlaneGeometry(
      window.innerWidth,
      window.innerHeight
    );
    this.backgroundMaterial = new THREE.ShaderMaterial({
      uniforms: backgroundShader.uniforms,
      vertexShader: backgroundShader.vertexShader,
      fragmentShader: backgroundShader.fragmentShader
    });
    const mesh = new THREE.Mesh(geometry, this.backgroundMaterial);
    this.scene.add(mesh);
  }

  updateWaterSimulation() {
    const { current, previous } = this.waterBuffers;
    const { damping, tension, resolution } = this.settings;
    const safeTension = Math.min(tension, 0.05);
    for (let i = 1; i < resolution - 1; i++) {
      for (let j = 1; j < resolution - 1; j++) {
        const index = i * resolution + j;
        const top = previous[index - resolution];
        const bottom = previous[index + resolution];
        const left = previous[index - 1];
        const right = previous[index + 1];
        current[index] = (top + bottom + left + right) / 2 - current[index];
        current[index] =
          current[index] * damping + previous[index] * (1 - damping);
        current[index] += (0 - previous[index]) * safeTension;
        current[index] = Math.max(-1.0, Math.min(1.0, current[index]));
      }
    }
    [this.waterBuffers.current, this.waterBuffers.previous] = [
      this.waterBuffers.previous,
      this.waterBuffers.current
    ];
    this.waterTexture.image.data = this.waterBuffers.current;
    this.waterTexture.needsUpdate = true;
  }

  addRipple(x, y, strength = 1.0) {
    const { resolution, rippleRadius } = this.settings;
    const normalizedX = x / window.innerWidth;
    const normalizedY = 1.0 - y / window.innerHeight;
    const texX = Math.floor(normalizedX * resolution);
    const texY = Math.floor(normalizedY * resolution);
    const radius = rippleRadius;
    const rippleStrength = strength;
    const radiusSquared = radius * radius;
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const distanceSquared = i * i + j * j;
        if (distanceSquared <= radiusSquared) {
          const posX = texX + i;
          const posY = texY + j;
          if (
            posX >= 0 &&
            posX < resolution &&
            posY >= 0 &&
            posY < resolution
          ) {
            const index = posY * resolution + posX;
            const distance = Math.sqrt(distanceSquared);
            const rippleValue =
              Math.cos(((distance / radius) * Math.PI) / 2) * rippleStrength;
            this.waterBuffers.previous[index] += rippleValue;
          }
        }
      }
    }
  }

  bindEvents() {
    window.addEventListener("mousemove", (ev) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const now = performance.now();
      if (now - this.mouseThrottleTime < 16) return;
      this.mouseThrottleTime = now;
      const dx = x - this.lastMousePosition.x;
      const dy = y - this.lastMousePosition.y;
      const distSquared = dx * dx + dy * dy;
      if (distSquared > 5) {
        this.addRipple(x, y, this.settings.mouseIntensity);
        this.lastMousePosition.x = x;
        this.lastMousePosition.y = y;
      }
    });
    window.addEventListener("click", (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.addRipple(x, y, this.settings.clickIntensity);
    });
    window.addEventListener("resize", () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.left = -width / 2;
      this.camera.right = width / 2;
      this.camera.top = height / 2;
      this.camera.bottom = -height / 2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      if (this.backgroundMaterial) {
        this.backgroundMaterial.uniforms.resolution.value.set(width, height);
      }
      if (this.scene.children[0] && this.scene.children[0].geometry) {
        this.scene.children[0].geometry.dispose();
        this.scene.children[0].geometry = new THREE.PlaneGeometry(
          width,
          height
        );
      }
      // adjust ring size so it stays around logo
      if (this.ring && this.ringInitialRadius) {
        const newRadius = Math.min(width, height) * 0.2;
        const scale = newRadius / this.ringInitialRadius;
        this.ring.scale.set(scale, scale, scale);
      }
    });
  }

  // create an animated glowing tube/ring around the centered logo
  createGlowingRing() {
    // radius in world (pixels) - will be scaled on resize
    // smaller multiplier to reduce overall ring size
    const baseRadius = Math.min(window.innerWidth, window.innerHeight) * 0.22;
    this.ringInitialRadius = baseRadius;

    const points = [];
    const segments = 200;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * baseRadius,
          Math.sin(angle) * baseRadius,
          0
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    // super-thick radius for a massive tube
    const geometry = new THREE.TubeGeometry(curve, 400, 12.0, 32, true);
    // Use a custom material with an animated, jagged, electro-style canvas texture
    this.ringCanvas = document.createElement('canvas');
    this.ringCanvas.width = 256;
    this.ringCanvas.height = 256;
    this.ringCtx = this.ringCanvas.getContext('2d');
    this.ringTex = new THREE.CanvasTexture(this.ringCanvas);
    this.ringTex.wrapS = this.ringTex.wrapT = THREE.RepeatWrapping;
    this.ringMaterial = new THREE.MeshBasicMaterial({
      map: this.ringTex,
      transparent: true,
      opacity: 0.97,
      color: 0xffffff
    });
    this.ring = new THREE.Mesh(geometry, this.ringMaterial);
    this.ring.visible = false; // wait for logo drop event
    this.scene.add(this.ring);
  }

  setupAutoDrops() {
    if (this.autoDropsInterval) {
      clearInterval(this.autoDropsInterval);
    }
    if (this.settings.autoDrops) {
      this.autoDropsInterval = setInterval(() => {
        if (!this.settings.autoDrops) return;
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        this.addRipple(x, y, this.settings.autoDropIntensity);
      }, this.settings.autoDropInterval);
    }
  }

  updateTextDistortion() {
    const turbulence = document.getElementById("turbulence");
    if (turbulence) {
      const time = this.clock.getElapsedTime();
      const frequency1 = 0.015 + Math.sin(time * 0.5) * 0.005;
      const frequency2 = 0.01 + Math.cos(time * 0.3) * 0.003;
      turbulence.setAttribute("baseFrequency", `${frequency1} ${frequency2}`);
    }
  }

  tick() {
    this.updateWaterSimulation();
    this.updateTextDistortion();
    if (this.backgroundMaterial) {
      this.backgroundMaterial.uniforms.rippleStrength.value = this.settings.rippleStrength;
      this.backgroundMaterial.uniforms.time.value += this.clock.getDelta();
    }

    // update ring position to follow logo DOM element and animate electro effect
    if (this.ring) {
      const logoDom = document.getElementById("logo-shield");
      if (logoDom) {
        const rect = logoDom.getBoundingClientRect();
        const worldX = rect.left + rect.width / 2 - window.innerWidth / 2;
        // lower the ring slightly by subtracting a small offset
        const offsetY = 20; // adjust as needed
        const worldY = window.innerHeight / 2 - (rect.top + rect.height / 2) - offsetY;
        this.ring.position.set(worldX, worldY, 0);
      }


      // Animate the electro effect on the ring's canvas with multi-octave noise
      const ctx = this.ringCtx;
      const w = this.ringCanvas.width;
      const h = this.ringCanvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w/2, h/2);
      const t = this.clock.getElapsedTime();
      // Multi-octave noise function (simple sum of sines for visual effect)
      function electroNoise(angle, time, layer) {
        let n = 0;
        n += Math.sin(angle * 8 + time * 3 + layer * 1.2) * 8;
        n += Math.cos(angle * 13 - time * 2.2 - layer) * 5;
        n += Math.sin(angle * 23 + time * 1.7 + layer * 2.1) * 3;
        n += Math.cos(angle * 37 - time * 1.1 - layer * 0.7) * 2;
        n += Math.sin(angle * 61 + time * 0.7 + layer * 0.3) * 1.5;
        return n;
      }
      // Draw multiple jagged, animated rings for a strong electro look
      for (let layer = 0; layer < 4; layer++) {
        ctx.beginPath();
        for (let i = 0; i <= 256; i++) {
          const angle = (i / 256) * Math.PI * 2;
          // Multi-octave noise for jaggedness
          const jag = electroNoise(angle, t, layer);
          // Make the ring thicker by increasing base radius and layer spread
          const r = 100 + layer * 13 + jag;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        // Animate alpha and color for more intense glow
        const pulse = 0.7 + 0.3 * Math.sin(t * 2.5 + layer);
        ctx.strokeStyle = `rgba(255,77,227,${0.22 * pulse - layer*0.045})`;
        ctx.lineWidth = 26 + layer * 14;
        ctx.shadowColor = '#ff4de3';
        ctx.shadowBlur = 48 + layer * 22 * pulse;
        ctx.stroke();
      }
      ctx.restore();
      this.ringTex.needsUpdate = true;

      // animate ring glow and rotation
      this.ring.rotation.z += 0.008;
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.tick());
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new App();
  // make trigger available globally for other code (logo drop)
  window.triggerFieryOutline = () => {
    if (window.AppInstance && window.AppInstance.ring) {
      window.AppInstance.ring.visible = true;
    }
  };
});


