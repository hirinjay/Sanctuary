import WorldMapView from '../world/WorldMapView'
import WorldUI from '../world/WorldUI'

export default function WorldScreen() {
  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh', overflow:'hidden',
      background:'#020408' }}>
      <WorldMapView />
      <WorldUI />
    </div>
  )
}
