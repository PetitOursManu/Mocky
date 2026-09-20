// The renderer of the continuous 3D world. Every number it paints comes from
// `world.js`, which is where the arithmetic lives and where a test can reach it;
// this file only turns those numbers into a GL scene.
//
// It lives beside the compositions and not under `blocks/`, and that is why it
// may import `three`: the rule that keeps `blocks/index.js` loadable in Mocky's
// own suite is about the registry, and the world is not a block — it is a
// GROUND, opened once per scene by `ComposedSceneVideo` exactly like the others.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { ThreeCanvas } from '@remotion/three'
import * as THREE from 'three'
import { FIELD_CAMERA_FOV, fieldCanvas } from './blocks/field.js'
import { WORLD_FOG_DENSITY, WORLD_RULE_THICKNESS, shapeTurn, worldCamera, worldColors } from './world.js'

/**
 * Points the camera for this frame, before the canvas draws it.
 *
 * A layout effect because `ThreeCanvas` draws in a PASSIVE one (`advance` in its
 * frame renderer), and layout effects run first: the frame is always drawn from
 * the camera this frame asked for, never from the previous one.
 */
const Rig = ({ shot }) => {
  const camera = useThree((state) => state.camera)
  useLayoutEffect(() => {
    camera.position.set(shot.position[0], shot.position[1], shot.position[2])
    camera.lookAt(shot.target[0], shot.target[1], shot.target[2])
    camera.updateMatrixWorld()
  })
  return null
}

/** A colour as the linear triplet three stores in a vertex attribute. */
function linear(hex) {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}

/**
 * A unit box whose six faces carry the three shades of the world's one mix.
 *
 * Baked into the geometry rather than lit, for the reason `WORLD_SHADES` gives:
 * a light multiplies a measured colour by a cosine nobody measured. Order is
 * three's own for a box — +x, −x, +y, −y, +z, −z, four vertices each.
 */
function stoneGeometry(colors) {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const faces = [colors.side, colors.side, colors.top, colors.face, colors.face, colors.face].map(linear)
  const data = []
  for (const face of faces) for (let v = 0; v < 4; v++) data.push(...face)
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data, 3))
  geometry.translate(0, 0.5, 0)
  return geometry
}

/** A faceted shape whose faces take four of the world's shades by where they point. */
function shapeGeometry(colors) {
  const geometry = new THREE.OctahedronGeometry(1, 0)
  const position = geometry.getAttribute('position')
  const data = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i)
    b.fromBufferAttribute(position, i + 1)
    c.fromBufferAttribute(position, i + 2)
    const normal = b.clone().sub(a).cross(c.clone().sub(a))
    const shade = normal.y > 0 ? (normal.x > 0 ? colors.top : colors.shape) : normal.x > 0 ? colors.side : colors.face
    const rgb = linear(shade)
    for (let v = 0; v < 3; v++) data.push(...rgb)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data, 3))
  return geometry
}

/** Many boxes in one draw call, placed once: the world does not move, the camera does. */
const Boxes = ({ geometry, material, items }) => {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const place = new THREE.Object3D()
    items.forEach((item, i) => {
      place.position.set(item.x, item.y ?? 0, item.z)
      place.scale.set(item.sx, item.sy, item.sz)
      place.updateMatrix()
      mesh.setMatrixAt(i, place.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />
}

/**
 * The world, seen from where the film's camera is at this frame.
 *
 * @param {{world: object, frame: number, palette: object, width: number, height: number}} props
 *   `world` is the film's layout (`ComposedSceneVideo` builds it once), and
 *   `frame` is the FILM's frame — the scene's own plus where the scene starts —
 *   which is the whole of what makes two world scenes one place.
 */
export const WorldGround = ({ world, frame, palette, width, height }) => {
  const colors = worldColors(palette)
  const resources = useMemo(() => {
    if (!colors) return null
    const basic = (options) => new THREE.MeshBasicMaterial({ toneMapped: false, ...options })
    return {
      stone: stoneGeometry(colors),
      shape: shapeGeometry(colors),
      rule: new THREE.BoxGeometry(1, 1, 1),
      painted: basic({ vertexColors: true }),
      ruled: basic({ color: new THREE.Color(colors.rule) }),
    }
    // The colours are the whole key: they are what the geometry was baked with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors?.top, colors?.side, colors?.face, colors?.rule, colors?.shape])

  const stones = useMemo(
    () => world.stones.map((s) => ({ x: s.x, z: s.z, sx: s.width, sy: s.height, sz: s.depth })),
    [world],
  )
  const rules = useMemo(
    () => [
      ...world.rules.rails.map((r) => ({ x: r.x, z: r.z, sx: WORLD_RULE_THICKNESS, sy: WORLD_RULE_THICKNESS, sz: r.length })),
      ...world.rules.across.map((r) => ({ x: 0, z: r.z, sx: world.rules.width, sy: WORLD_RULE_THICKNESS, sz: WORLD_RULE_THICKNESS })),
    ],
    [world],
  )

  // Nothing to paint: the palette gave the tint up so that a line could be read.
  if (!colors || !resources) return null

  const canvas = fieldCanvas({ width, height })
  const shot = worldCamera(world.flights, frame)

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: canvas.width,
        height: canvas.height,
        transformOrigin: 'top left',
        // Drawn inside the field budget and painted back over the frame: the
        // world has nothing on it finer than a rule dissolving into fog.
        transform: `scale(${canvas.scaleX}, ${canvas.scaleY})`,
      }}
    >
      <ThreeCanvas width={canvas.width} height={canvas.height} camera={{ fov: FIELD_CAMERA_FOV, near: 0.1, far: 240 }}>
        <Rig shot={shot} />
        {/*
          The fog is the ground's own colour, so a stone fades towards the one
          colour every run on this scene was measured against. See `world.js`.
        */}
        <fogExp2 attach="fog" args={[colors.ground, WORLD_FOG_DENSITY]} />
        <Boxes geometry={resources.rule} material={resources.ruled} items={rules} />
        <Boxes geometry={resources.stone} material={resources.painted} items={stones} />
        {world.shapes.map((shape, i) => (
          <mesh
            key={i}
            geometry={resources.shape}
            material={resources.painted}
            position={[shape.x, shape.y, shape.z]}
            rotation={shapeTurn(shape, frame)}
            scale={shape.size}
          />
        ))}
      </ThreeCanvas>
    </div>
  )
}
