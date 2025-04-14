import React, { useState, useCallback, useEffect, useRef, createRef } from "react";
import "./Experience.css";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import axios from "axios";

const API_URL = window.location.origin + "/api/get-3d-tiles"; // Change to your backend URL
//const API_URL = "http://localhost:5000/api/get-3d-tiles"; // Change to your backend URL
window.INDICIES = [2, 1, 0, 2, 0, 2, 3, 3, 3, 0, 1, 0, 0, 0, 0, 3, 2, 1, 0, 0, 0];

// A simple placeholder 3D object in the scene
function ModelPlaceholder({ ModelRef = null }) {
  return (
    <mesh ref={ModelRef} position={[1, 0, 0]}>
      {/* Replace this with a GLTF loader or any 3D component */}
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4CAF50" />
    </mesh>
  );
}

function GoogleTiles({ apiUrl, ModelRef, lat, long, indicies }) {
  const [glbUrl, setGlbUrl] = useState(null);

  useEffect(() => {
    async function fetchTileURL() {
      try {
        const response = await axios.post(apiUrl, {
          latitude: lat,
          longitude: long,
          Indicies: indicies,
          zoom: 17,
        }, {
          responseType: 'arraybuffer'
        });
        const arrayBuffer = response.data;
        const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
        const objectURL = URL.createObjectURL(blob);
        setGlbUrl(objectURL);
      } catch (error) {
        console.error("Error fetching 3D tiles:", error);
      }
    }
    fetchTileURL();
  }, [apiUrl]);

  if (!glbUrl) {
    return <ModelPlaceholder ModelRef={ModelRef} />;
  }

  const a = document.createElement("a");
  a.href = glbUrl;
  a.download = glbUrl.split("/").pop() + ".glb";
  console.log(glbUrl)
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  const { scene, nodes, materials } = useGLTF(glbUrl);
  console.log("Loaded GLTF Nodes:", nodes);
  console.log("Loaded GLTF Materials:", materials);
  console.log("Loaded Scene:", scene);

  if (indicies.length < 5) {
    return (
      <group ref={ModelRef} dispose={null} scale={[0.0001, 0.0001, 0.0001]} position={[scene.children[0].position.x/10000, scene.children[0].position.y/10000, scene.children[0].position.z/10000]}>
        {Object.keys(nodes).map((key) => (
          <mesh
            key={key}
            castShadow
            receiveShadow
            geometry={nodes[key].geometry}
            material={nodes[key].material}
          />
        ))}
      </group>
    );
  }

  return (
    <group ref={ModelRef} dispose={null} scale={[0.1, 0.1, 0.1]} position={[scene.children[0].position.x/10, scene.children[0].position.y/10, scene.children[0].position.z/10]}>
      {Object.keys(nodes).map((key) => (
        <mesh
          key={key}
          castShadow
          receiveShadow
          geometry={nodes[key].geometry}
          material={nodes[key].material}
        />
      ))}
    </group>
  );
}

export function Experience() {
  // Sidebar/resizing state
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  
  // Tiles rendered and metadata for selection
  const [tiles, setTiles] = useState([]);
  const [tileInfos, setTileInfos] = useState([]);
  
  // Global model reference used for recentering the camera
  const modelRef = useRef();
  const controlsRef = useRef();
  const earthTilesAdded = useRef(false);

  // Mouse event handlers for sidebar resizing
  const onMouseDown = useCallback((e) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  // Called when the mouse moves anywhere on the page
  const onMouseMove = useCallback(
    (e) => {
      if (!isResizing) return;
      // If the sidebar is on the right, we can compute new width as:
      const newWidth = document.body.clientWidth - e.clientX;
      // Optional min-width
      setSidebarWidth(newWidth < 200 ? 200 : newWidth);
    },
    [isResizing]
  );

  // Stop resizing on mouse up
  const onMouseUp = useCallback(() => {
    if (isResizing) setIsResizing(false);
  }, [isResizing]);

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // Function to recenter camera on the global modelRef
  const recenterCamera = () => {
    console.log("Camera Position", controlsRef.current.object.position);
    if (modelRef.current && controlsRef.current) {
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Set the orbit target to the center of the model
      controlsRef.current.target.set(center.x, center.y, center.z);
      controlsRef.current.update();

      // Adjust camera position to fit the model
      controlsRef.current.object.position.set(center.x, center.y, center.z + 10);
      controlsRef.current.object.lookAt(center);
    }
    console.log("Recentered camera to model");
    console.log("Camera Position", controlsRef.current.object.position);
    console.log("Object Size", modelRef.current.position);
  };

  const addTile = async (lat, long, indicies, key) => {

    if (!lat || !long) {
      lat = document.getElementById("Lat").value || 0;
      long = document.getElementById("Long").value || 0;
    }
    if (!indicies) {
      indicies = getIndices(lat, long, 21);
    }
    if (!key) {
      key = tiles.length;
    }

    // Use a unique key, for example using Date.now() or tiles.length
    const tileRef = createRef();
    console.log("Adding Tile", lat, long, indicies, key);
    const newTile = await (
      <GoogleTiles key={key} apiUrl={API_URL} ModelRef={tileRef} lat={lat} long={long} indicies={indicies} />
    );
    console.log("Added Tile", newTile);
    setTiles([...tiles, newTile]);
    setTileInfos([...tileInfos, { key: tiles.length, ref: tileRef }]);
  }

  const addEarth = () => {
    // Prevent re-running if already added
    if (earthTilesAdded.current) return;
    earthTilesAdded.current = true;

    // Clear previous tiles
    setTiles([]);
    setTileInfos([]);

    let newTiles = [];
    let newTilesInfos = [];

    // Loop over your desired ranges.
    // (Adjust the loops if needed.)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 4; k++) {
          for (let l = 0; l < 4; l++) {
            // Build the indicies array for each tile as needed
            let indicies = [2, 1, 0, 2, 0, 2, 3, 3, 3, 0, 1, 0, 0, 0, 0, 3, 2, 1, 0, 0, 0];
            indicies.push(i, j, k, l);
            
            // Use a unique key, for example using Date.now() or tiles.length
            const tileRef = createRef();
            const key = `Earth-${i}-${j}-${k}-${l}`
            console.log("Adding Tile", i, j, indicies, key);
            const newTile = (
              <GoogleTiles key={key} apiUrl={API_URL} ModelRef={tileRef} lat={i} long={j} indicies={indicies} />
            );
            newTiles.push(newTile);
            newTilesInfos.push({ key: key, ref: tileRef });

            console.log("Added Tile", newTile);
            //addTile(i, j, indicies, `Earth-${i}-${j}-${k}-${l}`);
            console.log("Added Earth Tile", i, j, k, l);
          }
        }
      }
    }

    setTiles([...tiles, ...newTiles]);
    setTileInfos([...tileInfos, ...newTilesInfos]);
  };

  const getIndices = async (lat, long, zoom) => {
    try {
      console.log("Fetching Indicies for:", lat, long, zoom);
      const response = await axios.post("http://localhost:5000/api/get-indicies", {
        latitude: lat,
        longitude: long,
        zoom: zoom,
      }, {
        responseType: 'json'
      });
      
      return response.data.indicies;

    } catch (error) {
      console.error("Error fetching 3D tiles:", error);
    }
  }


  const addOneRightToIndices = (indicies, zoom) => {

    console.log("Adding One Right");

    for (let i = indicies.length-1; i >= 0; i--) {
      if (indicies[i] % 2 == 0) {
        indicies[i] += 1;
        return;
      }
      indicies[i] -= 1;
    }
  }

  const addOneUpToIndices = (indicies, zoom) => {

    console.log("Adding One Up");

    for (let i = indicies.length-1; i >= 0; i--) {
      if (indicies[i] < 2) {
        indicies[i] += 2;
        return;
      }
      indicies[i] -= 2;
    }
  }

  const equalList = (list, list2) => {
    if (list.length != list2.length) {
      console.log("List Lengths not equal");
      return false;
    }
    for (let i = 0; i < list.length; i++) {
      if (list[i] != list2[i]) {
        return false;
      }
    }
    return true;
  }

  const equalRight = (list, list2) => {
    for (let i = 0; i < list.length; i++) {
      if (list[i]%2 != list2[i]%2) {
        return false;
      }
    }
    return true;
  }


  const addArea = async () => {

    let newTiles = [];
    let newTilesInfos = [];

    let lat = document.getElementById("Lat").value || 43.658518762655255;
    let long = document.getElementById("Long").value || -79.39809738990337;
    let latEnd = document.getElementById("LatEnd").value || 43.668597829694754;
    let longEnd = document.getElementById("LongEnd").value || -79.39416841221698;
    let zoom = document.getElementById("Zoom").value || 19;

    const BLIndices = await getIndices(lat, long, zoom);
    const TRIndices = await getIndices(latEnd, longEnd, zoom);

    let TileIndiciesArray = [];

    let currIndices = [...BLIndices];
    let currYIndices = [...BLIndices];

    while(!equalList(currIndices, TRIndices)) {
      currIndices = [...currYIndices];
      while (!equalRight(currIndices, TRIndices)) {
        TileIndiciesArray.push([...currIndices]);
        addOneRightToIndices(currIndices, zoom);
      }
      TileIndiciesArray.push([...currIndices]);
      addOneUpToIndices(currYIndices, zoom);
    }
    TileIndiciesArray.push([...currIndices]);

    console.log("TileIndiciesArray:", TileIndiciesArray);

    for (let i = 0; i < TileIndiciesArray.length; i++) {
      const element = TileIndiciesArray[i];

      const tileRef = createRef();
      const key = `Earth-00${i}`
      const newTile = (
        <GoogleTiles key={key} apiUrl={API_URL} ModelRef={tileRef} lat={lat} long={long} indicies={element} />
      );
      newTiles.push(newTile);
      newTilesInfos.push({ key: key, ref: tileRef });
      
    }

    console.log("BLIndices:", BLIndices, lat, long, zoom);
    console.log("TRIndices:", TRIndices);

    setTiles([...tiles, ...newTiles]);
    setTileInfos([...tileInfos, ...newTilesInfos]);

  }

  const clear = () => {
    setTiles([]);
    setTileInfos([]);
    earthTilesAdded.current = false;
  };

  return (
    <div className="container">
      {/* 3D Simulation Area */}
      <div className="simulation-area">
        {!isResizing && (
          <Canvas className="canvas">
            <ambientLight intensity={0.5} />
            <directionalLight position={[5,10,7]} intensity={0.7} />
            {tiles.map((tile) => tile)}
            <OrbitControls maxDistance={1000000} ref={controlsRef} />
          </Canvas>
        )}

        <div className="simulation-footer">
          {/* Playback controls */}
          <button className="button">⏪</button>
          <button className="button">⏯️</button>
          <button className="button">⏩</button>
          <button className="button" onClick={recenterCamera}>Recenter</button>
          {/* <button className="button" onClick={addTile}>Add Tile</button> */}
          <button className="button" onClick={addArea}>Add Area</button>
          {/* <button className="button" onClick={addEarth}>Add Earth</button> */}
          <button className="button" onClick={clear}>CLEAR</button>
          <div className="timeline">
            <input type="range" min="0" max="100" />
          </div>
        </div>
      </div>

      {/* Right Side Panel (Resizable) */}
      <div className="sidebar" style={{ width: sidebarWidth }}>
        {/* The draggable handle (resizer) */}
        <div className="resizer" onMouseDown={onMouseDown} />

        <div className="panel">
          <h3>Properties</h3>
          <h4>World Data</h4>
          <label>
            Location
            <input type="text" placeholder="Florida Keys West" />
          </label>
          <label>
            Latitude
            <input id="Lat" type="number" placeholder="0" />
          </label>
          <label>
            Longitude
            <input id="Long" type="number" placeholder="0" />
          </label>
          <label>
            Latitude End
            <input id="LatEnd" type="number" placeholder="0" />
          </label>
          <label>
            Longitude End
            <input id="LongEnd" type="number" placeholder="0" />
          </label>
          <label>
            Zoom
            <input id="Zoom" type="number" placeholder="0" />
          </label>
          <label>
            Area Size (sq. ft)
            <input type="number" placeholder="10000" />
          </label>
          <label>
            Region Type
            <select>
              <option>Suburb</option>
              <option>Urban</option>
              <option>Rural</option>
            </select>
          </label>
          <label>
            Soil Permeability
            <select>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>
          <label>
            Nearby Water Body
            <select>
              <option>Coastal</option>
              <option>River</option>
              <option>Lake</option>
            </select>
          </label>
          <label>
            Elevation / Altitude
            <input type="text" placeholder="0 ft" />
          </label>
          <label>
            Population Density
            <input type="text" placeholder="4723.0 / sq.mi" />
          </label>
        </div>

        {/* New panel to list all tile keys */}
        <div className="panel">
          <h3>Tile List</h3>
          {tileInfos.map((info) => (
            <button
              key={info.key}
              className="button"
              onClick={() => {
                // Change the global modelRef to point to this tile's ref and recenter
                if (info.ref.current) {
                  modelRef.current = info.ref.current;
                  recenterCamera();
                }
              }}
            >
              {info.key}
            </button>
          ))}
        </div>

        <div className="panel">
          <h3>Simulation</h3>
          {/* Simulation controls */}
          <label>
            Rainfall Intensity (mm/day)
            <input type="number" placeholder="200" />
          </label>
          <label>
            Flood Type
            <select>
              <option>Flash Flood</option>
              <option>River Flood</option>
              <option>Coastal Flood</option>
            </select>
          </label>
          <label>
            IPCC Scenario
            <select>
              <option>RCP 8.5</option>
              <option>RCP 4.5</option>
              <option>RCP 2.6</option>
            </select>
          </label>
          <label>
            Time Duration (days)
            <input type="number" placeholder="5" />
          </label>
          <div className="action-buttons">
            <button className="button">Reset</button>
            <button className="button">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
