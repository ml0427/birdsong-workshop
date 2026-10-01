(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.WorkshopContent = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Original, bounded content. Conditions are evaluated only on a real monthly use.
  const EVENTS = [
    { id: 'cen-path', npc: 'cen', recipe: 'staff', title: '夜路回音', branches: [
      { id: 'steady', strong: true, text: '阿岑沿溪邊試了木杖，光沿路面鋪開，能及早看清轉角。他想把下一件裝備留給防護，不急著換杖。' },
      { id: 'dim', text: '阿岑在溪邊轉角試了木杖。光只照清腳下，他放慢步伐走完；下次想把照路這件事先做好。' }
    ] },
    { id: 'cen-shield', npc: 'cen', recipe: 'shield', requires: 'cen-path', title: '河堤飛石', branches: [
      { id: 'agile', trait: 'light', strong: true, text: '河堤的碎石落下時，阿岑迅速轉盾接住；輕巧讓轉向較從容。他發現木杖的特性也能幫上木盾。' },
      { id: 'steady', strong: true, text: '阿岑用木盾擋住河堤碎石。握持穩定，他把盾留作防護；這次沒有要再添同類裝備。' },
      { id: 'strained', text: '阿岑用木盾擋住河堤碎石，手臂卻震了一下。他記下這次吃力的感覺，願意先謹慎使用，不急著追更高階材料。' }
    ] },
    { id: 'cen-cross', npc: 'cen', recipe: 'staff', trigger: 'cross', title: '舊杖新路', branches: [
      { id: 'steady', strong: true, text: '魔法鳥把{actor}使用舊木杖的消息帶給阿岑：修復後的光照穩定。阿岑認出自己贈還的那件，知道它已找到新的使用者。' },
      { id: 'careful', text: '魔法鳥把{actor}使用舊木杖的消息帶給阿岑：光仍較淡，對方放慢腳步走完。阿岑認出自己贈還的那件；舊物重新上路，也保留了原來的限制。' }
    ] },
    { id: 'he-wrist', npc: 'he', recipe: 'bracer', title: '溪口亂流', branches: [
      { id: 'reinforced', trait: 'solid', text: '小禾經過溪口的魔力亂流，護腕護住手臂；堅固接縫只磨耗 {wear} 點。她記下這次耐用的感覺，想把下一件裝備留給飛石防護。' },
      { id: 'protected', strong: true, text: '小禾經過溪口的魔力亂流，護身效果穩住手臂。接縫磨耗 {wear} 點；她還缺能擋飛石的木盾，不需要再買一只完整護腕。' },
      { id: 'careful', text: '小禾經過溪口的魔力亂流，護腕減輕了干擾，她仍得集中注意。接縫磨耗 {wear} 點，這次的限制她記住了。' }
    ] },
    { id: 'he-shield', npc: 'he', recipe: 'shield', requires: 'he-wrist', title: '碎石轉角', branches: [
      { id: 'agile', trait: 'light', strong: true, text: '小禾在碎石轉角抬盾，輕巧讓她及時換了角度，石子沒有擦到手臂。護腕與木盾分別處理了兩種困擾，她先保留現有裝備。' },
      { id: 'steady', strong: true, text: '小禾在碎石轉角抬盾，石子被穩穩擋下。護腕處理亂流，木盾抵擋衝擊，她暫時不需要另一面盾。' },
      { id: 'strained', text: '小禾在碎石轉角抬盾，擋住石子後手臂有些發麻。她把這次吃力的結果告訴工坊，暫時改走較平緩的路。' }
    ] },
    { id: 'he-replacement', npc: 'he', recipe: 'bracer', requires: 'he-wrist', trigger: 'replacement', title: '接縫再試', branches: [
      { id: 'reinforced', trait: 'solid', text: '小禾換下磨損護腕後，再走一次溪口。新護腕有堅固接縫，這次磨耗 {wear} 點；她比較了兩件的使用紀錄，願意先把這件用好。' },
      { id: 'familiar', text: '小禾換下磨損護腕後，再走一次溪口。新護腕恢復了防護，這次磨耗 {wear} 點；沒有額外堅固特性，她會繼續留意接縫。' }
    ] },
    { id: 'shu-amulet', npc: 'shu', recipe: 'amulet', title: '干擾邊界', branches: [
      { id: 'sustained', trait: 'solid', text: '望舒佩戴護符通過魔力交界。防護維持住，堅固結構把磨耗壓到 {wear} 點。她想比較先得到警示，與接觸後才抵擋的差別。' },
      { id: 'clear', strong: true, text: '望舒佩戴護符通過魔力交界，護身效果抵擋了干擾。她記住交界的位置，接著想試試佩戴式金鈴能否提前提醒。' },
      { id: 'interference', text: '望舒佩戴護符通過魔力交界，干擾減弱但沒有完全消散。她放慢腳步通過，接著想比較金鈴的警示時間。' }
    ] },
    { id: 'shu-bell', npc: 'shu', recipe: 'bell', requires: 'shu-amulet', title: '鈴聲先後', branches: [
      { id: 'early', strong: true, text: '望舒還沒走進魔力交界，金鈴就響了。她停在邊界外，接著想用木杖對照魔力方向；警示與照路是兩種用途，不必一直換更昂貴的金鈴。' },
      { id: 'late', text: '望舒靠近魔力交界時金鈴才響。她及時停步，記下「接近才有警示」的限制；下次想用木杖先對照魔力方向，而非只追求更高品質金鈴。' }
    ] },
    { id: 'shu-focus', npc: 'shu', recipe: 'staff', requires: 'shu-bell', title: '魔力對照', branches: [
      { id: 'precise', strong: true, text: '望舒用木杖在已記下的交界外引導魔光，方向穩定。她把這次觀察與先前鈴聲時機對照，現有警示與照路裝備已夠用。' },
      { id: 'dim', text: '望舒用木杖在已記下的交界外引導魔光，光仍較淡。她只確認近處方向，保留較遠處的不確定，沒有把一次觀察說成萬事安全。' }
    ] }
  ];
  const FOLLOWUPS = {
    'cen-path': { recipe: 'shield', text: '走過溪邊轉角後，我還想用木盾擋河堤的碎石。' },
    'he-wrist': { recipe: 'shield', text: '護腕已在溪口用過，接下來想用木盾處理飛石。' },
    'shu-amulet': { recipe: 'bell', text: '護符的干擾紀錄已留下，這次想試佩戴式金鈴的警示時間。' },
    'shu-bell': { recipe: 'staff', text: '金鈴的時機已試過，這次想用木杖在交界外對照魔力方向。' }
  };
  return { EVENTS, FOLLOWUPS };
});
