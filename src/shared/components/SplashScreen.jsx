import React, { useEffect, useRef, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
    const canvasRef = useRef(null);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Set canvas size
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.scale(dpr, dpr);

        const width = window.innerWidth;
        const height = window.innerHeight;

        // SVG logo path points (scaled and centered)
        const logoPoints = generateLogoPoints(width, height);

        // Particle system
        const particles = [];
        const particleCount = 300;

        // Create particles
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                // Random starting position
                x: Math.random() * width,
                y: Math.random() * height,
                // Target position from logo
                targetX: logoPoints[i % logoPoints.length].x,
                targetY: logoPoints[i % logoPoints.length].y,
                // Explosion velocity (will be set later)
                vx: 0,
                vy: 0,
                // Size
                radius: Math.random() * 2 + 1,
                // Opacity
                alpha: Math.random() * 0.5 + 0.5,
                // Animation phase tracking
                phase: 0 // 0: gathering, 1: formed, 2: exploding
            });
        }

        let animationTime = 0;
        const gatherDuration = 2000; // 2 seconds to gather
        const holdDuration = 800;     // 0.8 seconds to hold logo shape
        const explodeDuration = 1200; // 1.2 seconds to explode
        const totalDuration = gatherDuration + holdDuration + explodeDuration;

        let animationFrame;

        const animate = (timestamp) => {
            if (!animationTime) animationTime = timestamp;
            const elapsed = timestamp - animationTime;

            // Clear canvas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // Determine current phase
            let currentPhase;
            let phaseProgress;

            if (elapsed < gatherDuration) {
                currentPhase = 0; // Gathering
                phaseProgress = elapsed / gatherDuration;
            } else if (elapsed < gatherDuration + holdDuration) {
                currentPhase = 1; // Holding
                phaseProgress = 1;
            } else if (elapsed < totalDuration) {
                currentPhase = 2; // Exploding
                phaseProgress = (elapsed - gatherDuration - holdDuration) / explodeDuration;
            } else {
                // Animation complete
                setIsComplete(true);
                if (onComplete) {
                    setTimeout(onComplete, 300);
                }
                return;
            }

            // Update and draw particles
            particles.forEach((particle) => {
                if (currentPhase === 0) {
                    // Gathering phase - ease to target
                    const easeProgress = easeInOutCubic(phaseProgress);
                    particle.x = particle.x + (particle.targetX - particle.x) * easeProgress * 0.1;
                    particle.y = particle.y + (particle.targetY - particle.y) * easeProgress * 0.1;
                    particle.alpha = Math.min(1, 0.3 + easeProgress * 0.7);
                } else if (currentPhase === 1) {
                    // Holding phase - slight wobble
                    const wobble = Math.sin(elapsed * 0.005) * 2;
                    particle.x = particle.targetX + wobble;
                    particle.y = particle.targetY + wobble;
                    particle.alpha = 1;
                } else if (currentPhase === 2) {
                    // Exploding phase
                    if (particle.phase !== 2) {
                        // Initialize explosion velocity
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 3 + 2;
                        particle.vx = Math.cos(angle) * speed;
                        particle.vy = Math.sin(angle) * speed;
                        particle.phase = 2;
                    }

                    // Apply velocity with acceleration
                    particle.vx *= 1.05;
                    particle.vy *= 1.05;
                    particle.x += particle.vx;
                    particle.y += particle.vy;

                    // Fade out
                    particle.alpha = Math.max(0, 1 - phaseProgress);
                }

                // Draw particle
                ctx.fillStyle = `rgba(255, 255, 255, ${particle.alpha})`;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrame = requestAnimationFrame(animate);
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [onComplete]);

    return (
        <div className={`splash-screen ${isComplete ? 'fade-out' : ''}`}>
            <canvas ref={canvasRef} />
        </div>
    );
};

// Generate points along the logo paths
function generateLogoPoints(canvasWidth, canvasHeight) {
    const points = [];
    const svgWidth = 360;
    const svgHeight = 220;

    // Calculate scale to fit logo in center of screen (with some padding)
    const scale = Math.min(canvasWidth / svgWidth, canvasHeight / svgHeight) * 0.6;
    const offsetX = (canvasWidth - svgWidth * scale) / 2;
    const offsetY = (canvasHeight - svgHeight * scale) / 2;

    // Helper to transform SVG coordinates to canvas coordinates
    const transform = (x, y) => ({
        x: x * scale + offsetX,
        y: y * scale + offsetY
    });

    // Sample points from the three paths in the logo

    // Path 1: Beige V (Left) - "M20,50 L65,50 L100,130 L135,50 L180,50 L100,210 Z"
    addLinePoints(points, transform(20, 50), transform(65, 50), 8);
    addLinePoints(points, transform(65, 50), transform(100, 130), 20);
    addLinePoints(points, transform(100, 130), transform(135, 50), 20);
    addLinePoints(points, transform(135, 50), transform(180, 50), 8);
    addLinePoints(points, transform(180, 50), transform(100, 210), 30);
    addLinePoints(points, transform(100, 210), transform(20, 50), 30);

    // Path 2: Purple V (Middle) - "M100,50 L145,50 L180,130 L225,20 L270,20 L180,210 Z"
    addLinePoints(points, transform(100, 50), transform(145, 50), 8);
    addLinePoints(points, transform(145, 50), transform(180, 130), 20);
    addLinePoints(points, transform(180, 130), transform(225, 20), 25);
    addLinePoints(points, transform(225, 20), transform(270, 20), 8);
    addLinePoints(points, transform(270, 20), transform(180, 210), 35);
    addLinePoints(points, transform(180, 210), transform(100, 50), 30);

    // Path 3: Brown P Loop (Right) - simplified sampling
    addLinePoints(points, transform(270, 20), transform(310, 20), 8);
    addArcPoints(points, transform(310, 65), 45 * scale, 0, Math.PI, 15);
    addLinePoints(points, transform(228, 110), transform(242, 70), 8);
    addLinePoints(points, transform(242, 70), transform(310, 70), 10);
    addArcPoints(points, transform(310, 60), 10 * scale, 0, Math.PI, 5);
    addLinePoints(points, transform(258, 50), transform(225, 20), 8);

    return points;
}

// Helper to add points along a line
function addLinePoints(points, start, end, count) {
    for (let i = 0; i <= count; i++) {
        const t = i / count;
        points.push({
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
        });
    }
}

// Helper to add points along an arc
function addArcPoints(points, center, radius, startAngle, endAngle, count) {
    for (let i = 0; i <= count; i++) {
        const t = i / count;
        const angle = startAngle + (endAngle - startAngle) * t;
        points.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius
        });
    }
}

// Easing function
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default SplashScreen;
