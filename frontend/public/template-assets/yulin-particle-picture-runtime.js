function noiseLike(x, y, t, seed) {
  return (Math.sin(x * 0.013 + t + seed) + Math.cos(y * 0.017 - t * 0.7 + seed * 1.3)) * 0.5;
}

function showRuntimeError(container, message) {
  const error = document.createElement('div');
  error.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:#ff6b6b;font:13px monospace;background:#050505;';
  error.textContent = message;
  container.appendChild(error);
}

function runYulinParticlePicture(options = {}) {
  const THREE = options.THREE;
  const container = document.getElementById('canvas-container');
  if (!container) return;
  container.innerHTML = '';
  container.style.background = '#050607';

  if (!THREE) {
    showRuntimeError(container, 'THREE runtime missing');
    return;
  }

  const mode = options.mode || 'mapped';
  const mapped = mode !== 'unmapped';
  const imageUrl = options.imageUrl || '';
  const density = options.density || (mapped ? 8 : 24);
  const depthAmount = options.depthAmount || 300;
  const threshold = options.threshold || 45;
  const gridWidth = options.gridWidth || 3060;
  const gridHeight = options.gridHeight || 1500;
  const step = options.step || (mapped ? 4 : 10);
  const columns = Math.floor(gridWidth / density);
  const rows = Math.floor(gridHeight / density);
  const count = columns * rows;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050607);

  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 1, 5000);
  camera.position.set(0, 0, Math.max(columns * step * 0.9, 980));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, mapped ? 0.56 : 0.82));
  const directionalLight = new THREE.DirectionalLight(0xffffff, mapped ? 1.16 : 0.78);
  directionalLight.position.set(1, 0.5, 1.2);
  scene.add(directionalLight);

  const pointPositions = mapped ? new Float32Array(count * 3) : null;
  const pointColors = mapped ? new Float32Array(count * 3) : null;
  const geometry = mapped ? new THREE.BufferGeometry() : new THREE.BoxGeometry(1, 1, 1);
  if (mapped && pointPositions && pointColors) {
    geometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
  }
  const material = mapped
    ? new THREE.PointsMaterial({
      size: 10,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      toneMapped: false,
    })
    : new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      toneMapped: false,
    });
  const mesh = mapped ? new THREE.Points(geometry, material) : new THREE.InstancedMesh(geometry, material, count);
  if (!mapped) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);

  const origins = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const brightness = new Float32Array(count);
  const scales = new Float32Array(count);
  const life = new Float32Array(count);
  const rotation = new Float32Array(count * 3);
  const color = new THREE.Color();
  const dummy = new THREE.Object3D();

  let scatter = false;
  let explode = false;
  let staticFloat = false;
  let frontBreath = false;
  let rafId = 0;

  function initializeParticles(pixelData) {
    let index = 0;
    let visiblePixels = 0;
    let brightnessSum = 0;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const pixel = (y * columns + x) * 4;
        const r = mapped && pixelData ? pixelData[pixel] : 255;
        const g = mapped && pixelData ? pixelData[pixel + 1] : 255;
        const b = mapped && pixelData ? pixelData[pixel + 2] : 255;
        const br = mapped ? Math.max(r, g, b) : 255;
        const i3 = index * 3;

        brightness[index] = br;
        brightnessSum += br;
        if (!mapped || br >= threshold) visiblePixels += 1;
        if (mapped) {
          const normalizedBoost = 1.08 / Math.max(br, 1);
          const cr = br >= threshold ? Math.min(1, r * normalizedBoost) : 0;
          const cg = br >= threshold ? Math.min(1, g * normalizedBoost) : 0;
          const cb = br >= threshold ? Math.min(1, b * normalizedBoost) : 0;
          if (pointColors) {
            pointColors[i3] = cr;
            pointColors[i3 + 1] = cg;
            pointColors[i3 + 2] = cb;
          }
        } else {
          color.setRGB(1, 1, 1);
        }

        origins[i3] = (x - columns / 2) * step;
        origins[i3 + 1] = (rows / 2 - y) * step;
        origins[i3 + 2] = mapped && br > threshold ? (br / 255 - 0.5) * depthAmount : (Math.random() - 0.5) * 120;
        positions[i3] = origins[i3] + (mapped ? 0 : (Math.random() - 0.5) * 30);
        positions[i3 + 1] = origins[i3 + 1] + (mapped ? 0 : (Math.random() - 0.5) * 30);
        positions[i3 + 2] = origins[i3 + 2];
        seeds[index] = Math.random() * 1000;
        life[index] = Math.random();
        scales[index] = mapped ? 0 : 0.48 + Math.random() * 0.36;
        index += 1;
      }
    }
    if (mapped && geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
    window.__yulinParticleStats = {
      mapped,
      count,
      visiblePixels,
      averageBrightness: brightnessSum / Math.max(count, 1),
      columns,
      rows,
    };
  }

  function resetParticle(i) {
    const i3 = i * 3;
    positions[i3] = origins[i3];
    positions[i3 + 1] = origins[i3 + 1];
    positions[i3 + 2] = origins[i3 + 2];
    velocities[i3] = 0;
    velocities[i3 + 1] = 0;
    velocities[i3 + 2] = 0;
    life[i] = Math.random();
  }

  function handleKeyDown(event) {
    if (event.key === '1') scatter = !scatter;
    if (event.key === '2') {
      explode = true;
      for (let i = 0; i < count; i += 1) {
        if (scales[i] <= 0.1) continue;
        const i3 = i * 3;
        const length = Math.hypot(positions[i3], positions[i3 + 1], positions[i3 + 2]) || 1;
        const force = 18 + Math.random() * 42;
        velocities[i3] = (positions[i3] / length + (Math.random() - 0.5) * 0.6) * force;
        velocities[i3 + 1] = (positions[i3 + 1] / length + (Math.random() - 0.5) * 0.6) * force;
        velocities[i3 + 2] = (positions[i3 + 2] / length + (Math.random() - 0.5) * 0.6) * force;
      }
    }
    if (event.key === '3') for (let i = 0; i < count; i += 1) resetParticle(i);
    if (event.key === '4') staticFloat = !staticFloat;
    if (event.key === '5') frontBreath = !frontBreath;
  }

  function handleKeyUp(event) {
    if (event.key === '2') explode = false;
  }

  function animate(timeMs) {
    const time = timeMs * 0.001;
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const br = brightness[i];
      const targetScale = mapped
        ? (br >= threshold ? 0.35 + ((br - threshold) / (255 - threshold)) * 1.05 : 0)
        : 0.72 + Math.sin(time * 0.7 + seeds[i]) * 0.18;
      scales[i] += (targetScale - scales[i]) * (mapped ? 0.08 : 0.04);

      const maxAngle = mapped && br < 220 ? (1 - (Math.max(br, threshold) - threshold) / (220 - threshold)) * Math.PI : Math.PI * 0.38;

      if (explode) {
        rotation[i3] += 0.04;
        rotation[i3 + 1] += 0.035;
        rotation[i3 + 2] += 0.03;
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];
        velocities[i3] *= 0.85;
        velocities[i3 + 1] *= 0.85;
        velocities[i3 + 2] *= 0.85;
      } else if (scatter) {
        const n = noiseLike(positions[i3] * 0.01, positions[i3 + 1] * 0.01, time * 0.8, seeds[i]);
        const angle = n * Math.PI * 4;
        velocities[i3] += Math.cos(angle) * 0.28;
        velocities[i3 + 1] += Math.sin(angle) * 0.28;
        velocities[i3 + 2] += n * 1.2;
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];
        velocities[i3] *= 0.9;
        velocities[i3 + 1] *= 0.9;
        velocities[i3 + 2] *= 0.9;
        rotation[i3] += 0.018;
        rotation[i3 + 1] += 0.016;
        rotation[i3 + 2] += 0.014;
      } else if (frontBreath) {
        const breathZ = noiseLike(0, 0, time * 0.5, seeds[i]) * 55;
        rotation[i3] *= 0.92;
        rotation[i3 + 1] *= 0.92;
        rotation[i3 + 2] *= 0.92;
        positions[i3] += (origins[i3] - positions[i3]) * 0.08;
        positions[i3 + 1] += (origins[i3 + 1] - positions[i3 + 1]) * 0.08;
        positions[i3 + 2] += (origins[i3 + 2] + breathZ - positions[i3 + 2]) * 0.08;
      } else if (staticFloat) {
        rotation[i3] += (Math.sin(seeds[i]) * maxAngle - rotation[i3]) * 0.025;
        rotation[i3 + 1] += (Math.cos(seeds[i]) * maxAngle - rotation[i3 + 1]) * 0.025;
        rotation[i3 + 2] += (Math.sin(seeds[i] + 100) * maxAngle - rotation[i3 + 2]) * 0.025;
        positions[i3] += (origins[i3] - positions[i3]) * 0.1;
        positions[i3 + 1] += (origins[i3 + 1] - positions[i3 + 1]) * 0.1;
        positions[i3 + 2] += (origins[i3 + 2] - positions[i3 + 2]) * 0.1;
      } else {
        const n = noiseLike(positions[i3] * 0.01, positions[i3 + 1] * 0.01, time * 0.8, seeds[i]);
        const angle = n * Math.PI * 4;
        const floatSpeed = mapped && br >= threshold ? 1.65 - ((br - threshold) / (255 - threshold)) * 1.45 : 1.8;
        velocities[i3] += Math.cos(angle) * 0.35 * floatSpeed;
        velocities[i3 + 1] += Math.sin(angle) * 0.35 * floatSpeed;
        velocities[i3 + 2] += n * 1.5 * floatSpeed;
        velocities[i3] += (origins[i3] - positions[i3]) * 0.005;
        velocities[i3 + 1] += (origins[i3 + 1] - positions[i3 + 1]) * 0.005;
        velocities[i3 + 2] += (origins[i3 + 2] - positions[i3 + 2]) * 0.005;
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];
        velocities[i3] *= 0.85;
        velocities[i3 + 1] *= 0.85;
        velocities[i3 + 2] *= 0.85;
        rotation[i3] += (Math.sin(time * 0.35 + seeds[i]) * maxAngle - rotation[i3]) * 0.05;
        rotation[i3 + 1] += (Math.cos(time * 0.35 + seeds[i]) * maxAngle - rotation[i3 + 1]) * 0.05;
        rotation[i3 + 2] += (Math.sin(time * 0.35 + seeds[i] + 100) * maxAngle - rotation[i3 + 2]) * 0.05;
      }

      if (mapped && pointPositions) {
        const hidden = br < threshold && !scatter && !explode && !staticFloat && !frontBreath;
        pointPositions[i3] = hidden ? 99999 : positions[i3];
        pointPositions[i3 + 1] = hidden ? 99999 : positions[i3 + 1];
        pointPositions[i3 + 2] = hidden ? 99999 : positions[i3 + 2];
      } else {
        const finalSize = Math.max(0.01, density * 1.05 * scales[i]);
        dummy.position.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
        dummy.rotation.set(rotation[i3], rotation[i3 + 1], rotation[i3 + 2]);
        dummy.scale.setScalar(finalSize);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
    }
    if (mapped && geometry.attributes.position) {
      geometry.attributes.position.needsUpdate = true;
    } else {
      mesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }

  function startWithImage(image) {
    const sampler = document.createElement('canvas');
    sampler.width = columns;
    sampler.height = rows;
    const context = sampler.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, columns, rows);
    initializeParticles(context.getImageData(0, 0, columns, rows).data);
    rafId = requestAnimationFrame(animate);
  }

  function handleResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('resize', handleResize);

  const dispose = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('resize', handleResize);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
  if (Array.isArray(window.__disposeCallbacks)) window.__disposeCallbacks.push(dispose);

  if (!mapped) {
    initializeParticles(null);
    rafId = requestAnimationFrame(animate);
    return;
  }

  if (!imageUrl) {
    showRuntimeError(container, 'imageUrl missing');
    return;
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => startWithImage(image);
  image.onerror = () => showRuntimeError(container, 'image load failed');
  image.src = imageUrl;
}

window.runYulinParticlePicture = runYulinParticlePicture;
