import React, { useState } from 'react';

function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState('forward');

  const transformPose = (x, y) => {
    let newX = y;
    let newY = x;
    newY = 144 - newY;
    return { x: newX, y: newY };
  };

  const reverseTransformPose = (x, y) => {
    let newX = 144 - y;
    let newY = x;
    return { x: newX, y: newY };
  };

  const generateColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const generateId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'line-';
    for (let i = 0; i < 11; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  };

  const transformForward = () => {
    try {
      const result = [];
      const pathMatches = input.matchAll(/Path\d+\s*=\s*follower\.pathBuilder\(\)([\s\S]*?)\.build\(\);/g);
      
      for (const match of pathMatches) {
        const pathContent = match[1];
        const isCurve = pathContent.includes('new BezierCurve');
        const curveType = isCurve ? 'BezierCurve' : 'BezierLine';
        
        const poses = [];
        const poseMatches = pathContent.matchAll(/new Pose\(([\d.]+),\s*([\d.]+)\)/g);
        for (const poseMatch of poseMatches) {
          const x = parseFloat(poseMatch[1]);
          const y = parseFloat(poseMatch[2]);
          const transformed = transformPose(x, y);
          poses.push(`                                new Pose(${transformed.x.toFixed(3)}, ${transformed.y.toFixed(3)})`);
        }
        
        const linearMatch = pathContent.match(/setLinearHeadingInterpolation\(Math\.toRadians\(([\d.]+)\),\s*Math\.toRadians\(([\d.]+)\)\)/);
        const tangentMatch = pathContent.match(/setTangentHeadingInterpolation\(\)/);
        
        result.push('        follower.pathBuilder().addPath(');
        result.push(`                        new ${curveType}(`);
        result.push(poses.join(',\n'));
        result.push('                        )');
        
        if (linearMatch) {
          const angle1 = parseFloat(linearMatch[1]) - 90;
          const angle2 = parseFloat(linearMatch[2]) - 90;
          result.push(`                ).setLinearHeadingInterpolation(Math.toRadians(${angle1}), Math.toRadians(${angle2}))`);
        } else if (tangentMatch) {
          result.push('                ).setTangentHeadingInterpolation()');
        }
        
        result.push('                .setGlobalDeceleration()');
        result.push('                .build(),\n');
      }
      
      if (result.length > 0) {
        const lastBuildIndex = result.lastIndexOf('                .build(),\n');
        if (lastBuildIndex !== -1) {
          result[lastBuildIndex] = '                .build()';
        }
      }
      
      const finalOutput = 'pathChains = new PathChain[] {\n' + result.join('\n') + '\n};';
      setOutput(finalOutput);
    } catch (e) {
      setOutput('Error: ' + e.message);
    }
  };

  const transformReverse = () => {
    try {
      const result = ['public static class Paths {'];
      const pathMatches = input.matchAll(/follower\.pathBuilder\(\)\.addPath\(([\s\S]*?)\.build\(\)/g);
      
      let pathNum = 1;
      for (const match of pathMatches) {
        const pathContent = match[1];
        const isCurve = pathContent.includes('new BezierCurve');
        const curveType = isCurve ? 'BezierCurve' : 'BezierLine';
        
        result.push(`    public PathChain Path${pathNum};`);
        pathNum++;
      }
      
      result.push('    ');
      result.push('    public Paths(Follower follower) {');
      
      pathNum = 1;
      const pathMatches2 = input.matchAll(/follower\.pathBuilder\(\)\.addPath\(([\s\S]*?)\.build\(\)/g);
      
      for (const match of pathMatches2) {
        const pathContent = match[1];
        const isCurve = pathContent.includes('new BezierCurve');
        const curveType = isCurve ? 'BezierCurve' : 'BezierLine';
        
        const poses = [];
        const poseMatches = pathContent.matchAll(/new Pose\(([\d.]+),\s*([\d.]+)\)/g);
        for (const poseMatch of poseMatches) {
          const x = parseFloat(poseMatch[1]);
          const y = parseFloat(poseMatch[2]);
          const transformed = reverseTransformPose(x, y);
          poses.push(`            new Pose(${transformed.x.toFixed(3)}, ${transformed.y.toFixed(3)})`);
        }
        
        const linearMatch = pathContent.match(/setLinearHeadingInterpolation\(Math\.toRadians\(([\d.-]+)\),\s*Math\.toRadians\(([\d.-]+)\)\)/);
        const tangentMatch = pathContent.match(/setTangentHeadingInterpolation\(\)/);
        
        result.push(`      Path${pathNum} = follower.pathBuilder().addPath(`);
        result.push(`          new ${curveType}(`);
        result.push(poses.join(',\n            '));
        result.push('          )');
        
        if (linearMatch) {
          const angle1 = parseFloat(linearMatch[1]) + 90;
          const angle2 = parseFloat(linearMatch[2]) + 90;
          result.push(`        ).setLinearHeadingInterpolation(Math.toRadians(${angle1}), Math.toRadians(${angle2}))`);
        } else if (tangentMatch) {
          result.push('        ).setTangentHeadingInterpolation()');
        }
        
        result.push('        ');
        result.push('        .build();');
        pathNum++;
      }
      
      result.push('    }');
      result.push('  }');
      
      setOutput(result.join('\n'));
    } catch (e) {
      setOutput('Error: ' + e.message);
    }
  };

  const transformToPP = () => {
    try {
      const pathMatches = input.matchAll(/follower\.pathBuilder\(\)\.addPath\(([\s\S]*?)\.build\(\)/g);
      
      const lines = [];
      const sequence = [];
      let firstPose = null;
      let firstHeading = null;
      
      for (const match of pathMatches) {
        const pathContent = match[1];
        const isCurve = pathContent.includes('new BezierCurve');
        
        const poses = [];
        const poseMatches = pathContent.matchAll(/new Pose\(([\d.]+),\s*([\d.]+)\)/g);
        for (const poseMatch of poseMatches) {
          const x = parseFloat(poseMatch[1]);
          const y = parseFloat(poseMatch[2]);
          const original = reverseTransformPose(x, y);
          poses.push(original);
        }
        
        if (!firstPose && poses.length > 0) {
          firstPose = poses[0];
        }
        
        const linearMatch = pathContent.match(/setLinearHeadingInterpolation\(Math\.toRadians\(([\d.-]+)\),\s*Math\.toRadians\(([\d.-]+)\)\)/);
        const tangentMatch = pathContent.match(/setTangentHeadingInterpolation\(\)/);
        
        let headingType = 'constant';
        let startDeg = 0;
        let endDeg = 0;
        
        if (linearMatch) {
          headingType = 'linear';
          startDeg = parseFloat(linearMatch[1]) + 90;
          endDeg = parseFloat(linearMatch[2]) + 90;
          if (!firstHeading) firstHeading = { startDeg, endDeg };
        } else if (tangentMatch) {
          headingType = 'tangent';
        }
        
        const lineId = generateId();
        const controlPoints = poses.slice(1, -1).map(p => ({ x: p.x, y: p.y }));
        const endPoint = poses[poses.length - 1];
        
        lines.push({
          name: `Path ${lines.length + 1}`,
          endPoint: {
            x: endPoint.x,
            y: endPoint.y,
            heading: headingType,
            startDeg: startDeg,
            endDeg: endDeg,
            degrees: endDeg
          },
          controlPoints: controlPoints,
          color: generateColor(),
          id: lineId,
          waitBeforeMs: 0,
          waitAfterMs: 0,
          waitBeforeName: '',
          waitAfterName: ''
        });
        
        sequence.push({
          kind: 'path',
          lineId: lineId
        });
      }
      
      const ppFile = {
        startPoint: {
          x: firstPose?.x || 0,
          y: firstPose?.y || 0,
          heading: 'linear',
          startDeg: firstHeading?.startDeg || 90,
          endDeg: firstHeading?.endDeg || 180
        },
        lines: lines,
        shapes: [],
        sequence: sequence,
        version: '1.2.1',
        timestamp: new Date().toISOString()
      };
      
      setOutput(JSON.stringify(ppFile, null, 2));
    } catch (e) {
      setOutput('Error: ' + e.message);
    }
  };

  const handleTransform = () => {
    if (mode === 'forward') transformForward();
    else if (mode === 'reverse') transformReverse();
    else if (mode === 'toPP') transformToPP();
  };

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#111827',
      padding: '2rem',
    },
    maxWidth: {
      maxWidth: '1280px',
      margin: '0 auto',
    },
    title: {
      fontSize: '1.875rem',
      fontWeight: 'bold',
      color: 'white',
      marginBottom: '1.5rem',
    },
    buttonGroup: {
      marginBottom: '1rem',
      display: 'flex',
      gap: '1rem',
    },
    button: {
      padding: '0.5rem 1rem',
      borderRadius: '0.375rem',
      fontWeight: '500',
      border: 'none',
      cursor: 'pointer',
    },
    buttonActive: {
      backgroundColor: '#2563eb',
      color: 'white',
    },
    buttonInactive: {
      backgroundColor: '#374151',
      color: '#d1d5db',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '1.5rem',
    },
    gridLg: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '1.5rem',
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: '500',
      color: '#d1d5db',
      marginBottom: '0.5rem',
    },
    textarea: {
      width: '100%',
      height: '400px',
      backgroundColor: '#1f2937',
      color: 'white',
      padding: '1rem',
      borderRadius: '0.375rem',
      border: '1px solid #374151',
      fontFamily: 'monospace',
      fontSize: '0.875rem',
      resize: 'vertical',
    },
    actionButtons: {
      marginTop: '1.5rem',
      display: 'flex',
      gap: '1rem',
    },
    transformButton: {
      padding: '0.5rem 1.5rem',
      backgroundColor: '#2563eb',
      color: 'white',
      borderRadius: '0.375rem',
      fontWeight: '500',
      border: 'none',
      cursor: 'pointer',
    },
    transformButtonHover: {
      backgroundColor: '#1d4ed8',
    },
    copyButton: {
      padding: '0.5rem 1.5rem',
      backgroundColor: '#059669',
      color: 'white',
      borderRadius: '0.375rem',
      fontWeight: '500',
      border: 'none',
      cursor: 'pointer',
    },
    copyButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    infoBox: {
      marginTop: '1.5rem',
      backgroundColor: '#1f2937',
      padding: '1rem',
      borderRadius: '0.375rem',
      border: '1px solid #374151',
    },
    infoTitle: {
      fontSize: '1.125rem',
      fontWeight: '600',
      color: 'white',
      marginBottom: '0.5rem',
    },
    infoList: {
      color: '#d1d5db',
      fontSize: '0.875rem',
    },
    infoItem: {
      marginBottom: '0.25rem',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        <h1 style={styles.title}>Path Coordinate Transformer</h1>
        
        <div style={styles.buttonGroup}>
          <button
            onClick={() => setMode('forward')}
            style={{...styles.button, ...(mode === 'forward' ? styles.buttonActive : styles.buttonInactive)}}
          >
            Paths → pathChains
          </button>
          <button
            onClick={() => setMode('reverse')}
            style={{...styles.button, ...(mode === 'reverse' ? styles.buttonActive : styles.buttonInactive)}}
          >
            pathChains → Paths
          </button>
          <button
            onClick={() => setMode('toPP')}
            style={{...styles.button, ...(mode === 'toPP' ? styles.buttonActive : styles.buttonInactive)}}
          >
            pathChains → .pp file
          </button>
        </div>
        
        <div style={window.innerWidth >= 1024 ? styles.gridLg : styles.grid}>
          <div>
            <label style={styles.label}>Input</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={styles.textarea}
              placeholder={mode === 'forward' ? 'Paste Paths class...' : 'Paste pathChains array...'}
            />
          </div>
          
          <div>
            <label style={styles.label}>Output</label>
            <textarea
              value={output}
              readOnly
              style={styles.textarea}
              placeholder="Transformed output will appear here..."
            />
          </div>
        </div>
        
        <div style={styles.actionButtons}>
          <button
            onClick={handleTransform}
            style={styles.transformButton}
          >
            Transform
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(output)}
            style={{...styles.copyButton, ...(!output && styles.copyButtonDisabled)}}
            disabled={!output}
          >
            Copy Output
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;