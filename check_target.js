const fs = require('fs');
const content = fs.readFileSync('data.js', 'utf8');
eval(content);

const ramen = RECIPE_DATA.filter(r => r.category === '라면/면요리');
console.log('현재 라면/면요리 총 개수:', ramen.length);

const keywords = ['짜장', '짜파게티', '오빠게티', '간파게티', '짬뽕', '진짬뽕', '맵짜장', '짜장라면', '불짜장'];
const targets = ramen.filter(r => {
  const t = r.title.toLowerCase();
  return keywords.some(k => t.includes(k));
});

console.log('짜장/짜파게티/짬뽕 분리 대상 개수:', targets.length);
targets.forEach(r => {
  console.log('#' + r.indexNumber + ' [' + r.channel + '] ' + r.title);
});

// 전체 레시피 중에서 혹시 다른 카테고리에 짜장/짬뽕 키워드가 있는지도 검사
const otherTargets = RECIPE_DATA.filter(r => r.category !== '라면/면요리').filter(r => {
  const t = r.title.toLowerCase();
  return keywords.some(k => t.includes(k));
});
console.log('\n다른 카테고리에 있는 짜장/짬뽕 키워드 레시피:');
otherTargets.forEach(r => {
  console.log('#' + r.indexNumber + ' (' + r.category + ') [' + r.channel + '] ' + r.title);
});
