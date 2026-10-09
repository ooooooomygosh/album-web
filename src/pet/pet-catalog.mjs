// Stable ids are saved in settings and travel across room / wallpaper / desktop.
// The existing cat remains the fallback for older installations and bad snapshots.
export const DEFAULT_PET_ID = 'cat';
export const PETS = Object.freeze([
  Object.freeze({ id: 'cat', name: '奶糖', species: '小猫', emoji: '🐱', color: '#e8a25a', description: '爱听唱片的橘色小猫', greeting: '喵～ 我在陪你哦' }),
  Object.freeze({ id: 'chick', name: '蛋挞', species: '小黄鸡', emoji: '🐥', color: '#f4cd58', description: '圆滚滚的阳光小黄鸡', greeting: '啾啾～ 今天也慢慢来' }),
  Object.freeze({ id: 'bunny', name: '棉花', species: '小兔', emoji: '🐰', color: '#edddd1', description: '安静陪读的长耳小兔', greeting: '耳朵竖起来，听你说～' }),
  Object.freeze({ id: 'bear', name: '可可', species: '小熊', emoji: '🐻', color: '#b88a68', description: '温柔可靠的可可小熊', greeting: '抱抱，休息一下也很好' }),
  Object.freeze({ id: 'fox', name: '枫糖', species: '小狐狸', emoji: '🦊', color: '#df8755', description: '带着蓬松尾巴的小狐狸', greeting: '尾巴借你暖一暖～' }),
]);
const byId = new Map(PETS.map((pet) => [pet.id, pet]));
export const normalizePetId = (value) => byId.has(value) ? value : DEFAULT_PET_ID;
export const getPet = (value) => byId.get(normalizePetId(value));
