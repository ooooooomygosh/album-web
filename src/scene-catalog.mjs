/** Original room artwork and its interaction geometry. Keep IDs stable in saved settings. */
const pixelGeometry = { columns: [[445, 150], [606, 160], [776, 161], [946, 160]], rows: [[208, 150], [374, 152], [542, 159]] };
const warmGeometry = { columns: [[437, 156], [604, 162], [776, 164], [949, 163]], rows: [[200, 155], [371, 154], [536, 158]] };
const freezeGeometry = (geometry) => Object.freeze({
  columns: Object.freeze(geometry.columns.map((pair) => Object.freeze([...pair]))),
  rows: Object.freeze(geometry.rows.map((pair) => Object.freeze([...pair])))
});
const scenes = [
  { id: 'pixel', label: '像素小屋', description: '雪窗、木架与暖暖的壁炉', art: '/room-scenes/pixel-cabin.png', alt: '像素木屋，雪窗、十二格唱片架与壁炉', geometry: pixelGeometry, pixel: true, style: { accent: '#d8a66c', background: '#36251c' } },
  { id: 'warm', label: '写实小屋', description: '在琥珀色灯光里慢慢听歌', art: '/room-scenes/warm-cabin.png', alt: '温馨木屋，雪窗、十二格唱片架与壁炉', geometry: warmGeometry, pixel: false, style: { accent: '#dba668', background: '#432b1d' } },
  { id: 'forest', label: '林间书屋', description: '绿荫环抱的安静阅读角', art: '/room-scenes/forest-cabin.svg', alt: '林间书屋，拱形森林窗、植物、十二格唱片架与绿色沙发', geometry: pixelGeometry, pixel: false, style: { accent: '#b7c59a', background: '#3d4e43' } },
  { id: 'seaside', label: '海边慢屋', description: '海风、亚麻与午后的光', art: '/room-scenes/seaside-cabin.svg', alt: '海边慢屋，圆形海景窗、阳台、浅木唱片架与条纹亚麻椅', geometry: pixelGeometry, pixel: false, style: { accent: '#bcd4c3', background: '#718b85' } },
  { id: 'starlight', label: '星夜阁楼', description: '星光落在深夜的唱片上', art: '/room-scenes/starlight-cabin.svg', alt: '星夜阁楼，星空圆窗、望远镜、十二格唱片架与暖灯阅读椅', geometry: pixelGeometry, pixel: false, style: { accent: '#c1b7db', background: '#303b50' } }
];

export const ROOM_SCENES = Object.freeze(scenes.map((scene) => Object.freeze({ ...scene, geometry: freezeGeometry(scene.geometry), style: Object.freeze(scene.style) })));
export const ROOM_SCENE_IDS = Object.freeze(ROOM_SCENES.map(({ id }) => id));
const byId = new Map(ROOM_SCENES.map((scene) => [scene.id, scene]));
export function normalizeRoomSceneId(id) { return byId.has(id) ? id : 'pixel'; }
export function getRoomScene(id) { return byId.get(normalizeRoomSceneId(id)); }
