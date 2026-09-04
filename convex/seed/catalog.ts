export const moods = [
  ["peaceful","desired_feeling","An yên","Peaceful","Chậm lại, thở sâu, ít kích thích.","Slow down, breathe, low stimulation.","Nơi nào giúp bạn thấy an yên?","Where would help you feel peaceful?","mood-peaceful","leaf",10],
  ["recharged","desired_feeling","Nạp năng lượng","Recharged","Tỉnh táo lại sau một ngày dài.","Feel restored after a long day.","Nơi nào giúp bạn nạp lại năng lượng?","Where would help you feel recharged?","mood-recharged","sun",20],
  ["inspired","desired_feeling","Cảm hứng","Inspired","Muốn nhìn thế giới khác đi một chút.","See the world from a new angle.","Nơi nào khơi cảm hứng cho bạn?","Where would help you feel inspired?","mood-inspired","sparkles",30],
  ["connected","desired_feeling","Kết nối","Connected","Muốn gần người khác, hoặc gần thành phố.","Feel close to people or the city.","Nơi nào giúp bạn thấy được kết nối?","Where would help you feel connected?","mood-connected","users",40],
  ["excited","desired_feeling","Hào hứng","Excited","Muốn nhịp nhanh, có chuyện xảy ra.","Want energy, movement, something happening.","Nơi nào làm bạn hào hứng?","Where would help you feel excited?","mood-excited","zap",50],
  ["romantic","desired_feeling","Lãng mạn","Romantic","Không gian cho hai người, ánh sáng dịu.","A space for two, softer light.","Nơi nào mang cảm giác lãng mạn?","Where would help you feel romantic?","mood-romantic","heart",60],
  ["focused","desired_feeling","Tập trung","Focused","Cần yên để làm việc hoặc đọc.","Need calm to work or read.","Nơi nào giúp bạn tập trung?","Where would help you feel focused?","mood-focused","target",70],
  ["tired","current_state","Mệt","Tired","Năng lượng thấp, cần nhịp chậm.","Low energy, need a slower pace.",null,null,"mood-peaceful","moon",10],
  ["stressed","current_state","Căng thẳng","Stressed","Đầu quá đầy, cần chỗ thở.","Mind is full, need room to breathe.",null,null,"mood-recharged","cloud",20],
  ["bored","current_state","Chán","Bored","Cần một kích thích vừa phải.","Need a gentle spark.",null,null,"mood-excited","coffee",30],
  ["energetic","current_state","Tràn năng lượng","Energetic","Muốn đi, muốn thấy thành phố.","Want to move and see the city.",null,null,"mood-excited","flame",40],
  ["lonely","current_state","Cô đơn","Lonely","Muốn cảm giác có người xung quanh.","Want the feeling of people nearby.",null,null,"mood-connected","user",50],
  ["overwhelmed","current_state","Quá tải","Overwhelmed","Cần ít lựa chọn, ít ồn.","Need fewer choices and less noise.",null,null,"mood-peaceful","waves",60],
] as const;

export const experienceStyles = [
  ["nature","Thiên nhiên","Nature","Cây, nước, khoảng trống.","Trees, water, open air.","trees",10],
  ["cafe","Quán cà phê","Cafe","Ngồi lâu, quan sát, cà phê.","Sit long, watch, coffee.","coffee",20],
  ["food","Ẩm thực","Food","Ăn uống là trải nghiệm chính.","Eating is the experience.","utensils",30],
  ["culture","Văn hóa","Culture","Sử, nghệ thuật, kiến trúc.","History, art, architecture.","landmark",40],
  ["adventure","Khám phá","Adventure","Cao, mới, hơi hồi hộp.","Height, novelty, a little thrill.","compass",50],
  ["nightlife","Về đêm","Nightlife","Đèn, nhạc, thành phố thức.","Lights, music, the city awake.","moon",60],
  ["wellness","Chăm sóc","Wellness","Cơ thể được nghỉ.","The body gets to rest.","heart-pulse",70],
  ["hidden-gem","Góc khuất","Hidden gem","Ít người biết, không phải điểm check-in ồn.","Fewer people, not a loud check-in spot.","gem",80],
] as const;

export const placeCategories = [
  ["cafe","Quán cà phê","Cafe","coffee",90,10],
  ["park","Công viên","Park","trees",75,20],
  ["museum","Bảo tàng","Museum","building",120,30],
  ["heritage","Di tích","Heritage","landmark",60,40],
  ["restaurant","Nhà hàng","Restaurant","utensils",90,50],
  ["market","Chợ","Market","store",60,60],
  ["viewpoint","Điểm nhìn","Viewpoint","mountain",60,70],
  ["bar","Quán bar","Bar","wine",120,80],
  ["spa","Spa","Spa","flower",90,90],
  ["street","Không gian phố","Street space","map",45,100],
] as const;
