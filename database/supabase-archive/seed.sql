-- Realidi seed: HCMC city-first density. No lorem ipsum.
-- Taxonomy + editorial places. Demo users/posts are in scripts/seed-demo.ts
-- so hosted projects can seed via the service role without touching auth.users here.

-- ---------------------------------------------------------------------------
-- Moods — Desired feeling (primary UX)
-- ---------------------------------------------------------------------------
insert into public.moods (id, slug, layer, name_vi, name_en, description_vi, description_en, prompt_vi, prompt_en, color_token, icon, sort_order) values
  ('11111111-1111-4111-8111-111111111001', 'peaceful', 'desired_feeling', 'An yên', 'Peaceful', 'Chậm lại, thở sâu, ít kích thích.', 'Slow down, breathe, low stimulation.', 'Nơi nào giúp bạn thấy an yên?', 'Where would help you feel peaceful?', 'mood-peaceful', 'leaf', 10),
  ('11111111-1111-4111-8111-111111111002', 'recharged', 'desired_feeling', 'Nạp năng lượng', 'Recharged', 'Tỉnh táo lại sau một ngày dài.', 'Feel restored after a long day.', 'Nơi nào giúp bạn nạp lại năng lượng?', 'Where would help you feel recharged?', 'mood-recharged', 'sun', 20),
  ('11111111-1111-4111-8111-111111111003', 'inspired', 'desired_feeling', 'Cảm hứng', 'Inspired', 'Muốn nhìn thế giới khác đi một chút.', 'See the world from a new angle.', 'Nơi nào khơi cảm hứng cho bạn?', 'Where would help you feel inspired?', 'mood-inspired', 'sparkles', 30),
  ('11111111-1111-4111-8111-111111111004', 'connected', 'desired_feeling', 'Kết nối', 'Connected', 'Muốn gần người khác, hoặc gần thành phố.', 'Feel close to people or the city.', 'Nơi nào giúp bạn thấy được kết nối?', 'Where would help you feel connected?', 'mood-connected', 'users', 40),
  ('11111111-1111-4111-8111-111111111005', 'excited', 'desired_feeling', 'Hào hứng', 'Excited', 'Muốn nhịp nhanh, có chuyện xảy ra.', 'Want energy, movement, something happening.', 'Nơi nào làm bạn hào hứng?', 'Where would help you feel excited?', 'mood-excited', 'zap', 50),
  ('11111111-1111-4111-8111-111111111006', 'romantic', 'desired_feeling', 'Lãng mạn', 'Romantic', 'Không gian cho hai người, ánh sáng dịu.', 'A space for two, softer light.', 'Nơi nào mang cảm giác lãng mạn?', 'Where would help you feel romantic?', 'mood-romantic', 'heart', 60),
  ('11111111-1111-4111-8111-111111111007', 'focused', 'desired_feeling', 'Tập trung', 'Focused', 'Cần yên để làm việc hoặc đọc.', 'Need calm to work or read.', 'Nơi nào giúp bạn tập trung?', 'Where would help you feel focused?', 'mood-focused', 'target', 70)
on conflict (id) do nothing;

-- Current state (optional onboarding)
insert into public.moods (id, slug, layer, name_vi, name_en, description_vi, description_en, color_token, icon, sort_order, is_active) values
  ('11111111-1111-4111-8111-111111111101', 'tired', 'current_state', 'Mệt', 'Tired', 'Năng lượng thấp, cần nhịp chậm.', 'Low energy, need a slower pace.', 'mood-peaceful', 'moon', 10, true),
  ('11111111-1111-4111-8111-111111111102', 'stressed', 'current_state', 'Căng thẳng', 'Stressed', 'Đầu quá đầy, cần chỗ thở.', 'Mind is full, need room to breathe.', 'mood-recharged', 'cloud', 20, true),
  ('11111111-1111-4111-8111-111111111103', 'bored', 'current_state', 'Chán', 'Bored', 'Cần một kích thích vừa phải.', 'Need a gentle spark.', 'mood-excited', 'coffee', 30, true),
  ('11111111-1111-4111-8111-111111111104', 'energetic', 'current_state', 'Tràn năng lượng', 'Energetic', 'Muốn đi, muốn thấy thành phố.', 'Want to move and see the city.', 'mood-excited', 'flame', 40, true),
  ('11111111-1111-4111-8111-111111111105', 'lonely', 'current_state', 'Cô đơn', 'Lonely', 'Muốn cảm giác có người xung quanh.', 'Want the feeling of people nearby.', 'mood-connected', 'user', 50, true),
  ('11111111-1111-4111-8111-111111111106', 'overwhelmed', 'current_state', 'Quá tải', 'Overwhelmed', 'Cần ít lựa chọn, ít ồn.', 'Need fewer choices and less noise.', 'mood-peaceful', 'waves', 60, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Experience styles (secondary filters)
-- ---------------------------------------------------------------------------
insert into public.experience_styles (id, slug, name_vi, name_en, description_vi, description_en, icon, sort_order) values
  ('22222222-2222-4222-8222-222222222001', 'nature', 'Thiên nhiên', 'Nature', 'Cây, nước, khoảng trống.', 'Trees, water, open air.', 'trees', 10),
  ('22222222-2222-4222-8222-222222222002', 'cafe', 'Quán cà phê', 'Cafe', 'Ngồi lâu, quan sát, cà phê.', 'Sit long, watch, coffee.', 'coffee', 20),
  ('22222222-2222-4222-8222-222222222003', 'food', 'Ẩm thực', 'Food', 'Ăn uống là trải nghiệm chính.', 'Eating is the experience.', 'utensils', 30),
  ('22222222-2222-4222-8222-222222222004', 'culture', 'Văn hóa', 'Culture', 'Sử, nghệ thuật, kiến trúc.', 'History, art, architecture.', 'landmark', 40),
  ('22222222-2222-4222-8222-222222222005', 'adventure', 'Khám phá', 'Adventure', 'Cao, mới, hơi hồi hộp.', 'Height, novelty, a little thrill.', 'compass', 50),
  ('22222222-2222-4222-8222-222222222006', 'nightlife', 'Về đêm', 'Nightlife', 'Đèn, nhạc, thành phố thức.', 'Lights, music, the city awake.', 'moon', 60),
  ('22222222-2222-4222-8222-222222222007', 'wellness', 'Chăm sóc', 'Wellness', 'Cơ thể được nghỉ.', 'The body gets to rest.', 'heart-pulse', 70),
  ('22222222-2222-4222-8222-222222222008', 'hidden-gem', 'Góc khuất', 'Hidden gem', 'Ít người biết, không phải điểm check-in ồn.', 'Fewer people, not a loud check-in spot.', 'gem', 80)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
insert into public.place_categories (id, slug, name_vi, name_en, icon, typical_duration_minutes, sort_order) values
  ('33333333-3333-4333-8333-333333333001', 'cafe', 'Quán cà phê', 'Cafe', 'coffee', 90, 10),
  ('33333333-3333-4333-8333-333333333002', 'park', 'Công viên', 'Park', 'trees', 75, 20),
  ('33333333-3333-4333-8333-333333333003', 'museum', 'Bảo tàng', 'Museum', 'building', 120, 30),
  ('33333333-3333-4333-8333-333333333004', 'heritage', 'Di tích', 'Heritage', 'landmark', 60, 40),
  ('33333333-3333-4333-8333-333333333005', 'restaurant', 'Nhà hàng', 'Restaurant', 'utensils', 90, 50),
  ('33333333-3333-4333-8333-333333333006', 'market', 'Chợ', 'Market', 'store', 60, 60),
  ('33333333-3333-4333-8333-333333333007', 'viewpoint', 'Điểm nhìn', 'Viewpoint', 'mountain', 60, 70),
  ('33333333-3333-4333-8333-333333333008', 'bar', 'Quán bar', 'Bar', 'wine', 120, 80),
  ('33333333-3333-4333-8333-333333333009', 'spa', 'Spa', 'Spa', 'flower', 90, 90),
  ('33333333-3333-4333-8333-333333333010', 'street', 'Không gian phố', 'Street space', 'map', 45, 100)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Places — TP. Hồ Chí Minh, curated density over coverage
-- Cover images: Unsplash (editorial placeholders until place-media is uploaded)
-- ---------------------------------------------------------------------------
insert into public.places (
  id, slug, name, short_description, description, category_id,
  address, district, city, country, latitude, longitude,
  cover_image_path, website, price_level, typical_duration_minutes,
  typical_spend_min, typical_spend_max, status, source, verified_by_admin,
  editorial_score, admin_quality_score
) values
  (
    '44444444-4444-4444-8444-444444444001',
    'the-workshop-sai-gon',
    'The Workshop',
    'Quán specialty coffee yên, phù hợp ngồi làm việc hoặc đọc.',
    'The Workshop ở trung tâm Quận 1 nổi tiếng vì rang tại chỗ và không gian khá trật tự so với nhịp Sài Gòn bên ngoài. Ánh sáng tự nhiên, bàn gỗ, ít loa. Người hay tới khi cần đầu óc tỉnh mà không muốn quán ồn. Cuối tuần đông hơn ngày thường, nhưng vẫn giữ được nhịp chậm nếu chọn tầng trên.',
    '33333333-3333-4333-8333-333333333001',
    '27 Ngô Đức Kế', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7736, 106.7057,
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600&q=80',
    'https://theworkshop.vn', 3, 90, 70000, 150000, 'active', 'editorial', true, 0.86, 0.88
  ),
  (
    '44444444-4444-4444-8444-444444444002',
    'cong-caphe-ton-that-thiep',
    'Cộng Cà Phê Tôn Thất Thiệp',
    'Cà phê sữa đá trong không gian hoài niệm, dễ gặp bạn bè.',
    'Cộng mang cảm giác Sài Gòn thập niên 80: đồ quân dụng, bàn gỗ mộc, ly sữa đá quen thuộc. Tôn Thất Thiệp nằm gần phố đi bộ nên cuối tuần ồn và đông. Phù hợp khi muốn cảm giác quen thuộc và được bao quanh bởi người, không phải chỗ để tập trung sâu.',
    '33333333-3333-4333-8333-333333333001',
    '26 Lý Tự Trọng', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7759, 106.7008,
    'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=1600&q=80',
    'https://congcaphe.com', 2, 60, 45000, 90000, 'active', 'editorial', true, 0.78, 0.80
  ),
  (
    '44444444-4444-4444-8444-444444444003',
    'lusine-le-loi',
    'L''Usine Lê Lợi',
    'Quán concept store + cà phê, ánh sáng đẹp, nhịp thành thị.',
    'L''Usine vừa là quán vừa là cửa hàng. Trần cao, gạch bông, cửa kính nhìn ra Lê Lợi. Người tới để ăn brunch, chụp ảnh, hoặc ngồi quan sát phố. Không yên như specialty coffee thuần, nhưng mang cảm giác Sài Gòn hiện đại rõ hơn nhiều quán khác ở Quận 1.',
    '33333333-3333-4333-8333-333333333001',
    '151/1 Đồng Khởi', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7752, 106.7036,
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1600&q=80',
    'https://lusinespace.com', 3, 75, 90000, 220000, 'active', 'editorial', true, 0.74, 0.76
  ),
  (
    '44444444-4444-4444-8444-444444444004',
    'the-hideout-cafe',
    'The Hideout Café',
    'Quán nhỏ, khó thấy từ phố, phù hợp khi muốn biến mất vài giờ.',
    'The Hideout đúng như tên: nằm trong hẻm, không bảng hiệu lớn. Không gian hẹp, đèn vàng, ít chỗ. Rất hợp khi đang quá tải và không muốn ai vô tình gặp. Cuối tuần vẫn kín chỗ nên nên đi sớm. Không phải nơi cho nhóm đông.',
    '33333333-3333-4333-8333-333333333001',
    'Hẻm gần Pasteur', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7768, 106.6959,
    'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1600&q=80',
    null, 2, 70, 50000, 110000, 'active', 'editorial', true, 0.81, 0.79
  ),
  (
    '44444444-4444-4444-8444-444444444005',
    'cong-vien-tao-dan',
    'Công viên Tao Đàn',
    'Mảng xanh giữa trung tâm, đi bộ buổi sáng hoặc chiều mát.',
    'Tao Đàn là một trong số ít khoảng thở lớn của Quận 1. Sáng sớm có người tập thể dục, chim, bóng cây. Trưa nóng và vắng. Chiều muộn dễ chịu hơn. Không có cà phê ngon trong công viên, nhưng 45–90 phút đi bộ ở đây thường đủ để đầu óc chậm lại trước khi trở lại phố.',
    '33333333-3333-4333-8333-333333333002',
    'Trương Định', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7753, 106.6924,
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&q=80',
    null, 1, 75, 0, 30000, 'active', 'editorial', true, 0.90, 0.84
  ),
  (
    '44444444-4444-4444-8444-444444444006',
    'thao-cam-vien-sai-gon',
    'Thảo Cầm Viên Sài Gòn',
    'Công viên lâu đời, hợp gia đình và ngày cuối tuần chậm.',
    'Thảo Cầm Viên rộng, rợp cây, có hồ và đường đi bộ dài. Không phải sở thú hiện đại theo chuẩn quốc tế, nhưng là chỗ Sài Gòn quen thuộc để đi với trẻ em hoặc khi muốn ra khỏi phố mà không cần ra khỏi thành phố. Cuối tuần đông; ngày thường thoáng hơn nhiều.',
    '33333333-3333-4333-8333-333333333002',
    '2 Nguyễn Bỉnh Khiêm', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7877, 106.7050,
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&q=80',
    null, 2, 120, 50000, 150000, 'active', 'editorial', true, 0.72, 0.70
  ),
  (
    '44444444-4444-4444-8444-444444444007',
    'dinh-doc-lap',
    'Dinh Độc Lập',
    'Công trình hiện đại giữa trung tâm, nặng ký ức lịch sử.',
    'Dinh Độc Lập (Dinh Thống Nhất) là nơi nên đi khi muốn hiểu Sài Gòn không chỉ qua quán xá. Không gian rộng, phòng họp, đường hầm, sân cỏ. Trải nghiệm thiên về quan sát và suy nghĩ hơn là giải trí. Nên đi vào buổi sáng để tránh nắng gắt trên sân.',
    '33333333-3333-4333-8333-333333333004',
    '135 Nam Kỳ Khởi Nghĩa', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7769, 106.6954,
    'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1600&q=80',
    'https://dinhdoclap.gov.vn', 2, 90, 40000, 80000, 'active', 'editorial', true, 0.88, 0.90
  ),
  (
    '44444444-4444-4444-8444-444444444008',
    'bao-tang-chung-tich-chien-tranh',
    'Bảo tàng Chứng tích Chiến tranh',
    'Nơi nặng, cần thời gian và tâm thế sẵn sàng.',
    'Đây không phải điểm đến để “cho vui”. Hiện vật và hình ảnh đòi hỏi sự chú ý. Nhiều người rời đi im lặng. Nếu đang tìm cảm giác nhẹ hoặc lãng mạn, đừng xếp chỗ này vào cùng buổi. Nếu muốn hiểu thành phố sâu hơn, đây là một trong những nơi trung thực nhất.',
    '33333333-3333-4333-8333-333333333003',
    '28 Võ Văn Tần', 'Quận 3', 'TP. Hồ Chí Minh', 'VN',
    10.7795, 106.6921,
    'https://images.unsplash.com/photo-1461360370896-92243d03f8c6?w=1600&q=80',
    null, 2, 120, 40000, 80000, 'active', 'editorial', true, 0.84, 0.92
  ),
  (
    '44444444-4444-4444-8444-444444444009',
    'nha-tho-duc-ba',
    'Nhà thờ Đức Bà',
    'Điểm định vị trung tâm, hợp đi bộ và quan sát nhịp phố.',
    'Công trình đang trong quá trình tu bổ nên trải nghiệm thay đổi theo thời điểm. Quảng trường phía trước vẫn là chỗ hội tụ: xe, người, ánh sáng chiều. Hợp khi muốn cảm giác “đang ở Sài Gòn”, không phải khi cần yên. Kết hợp tốt với Bưu điện Trung tâm kế bên.',
    '33333333-3333-4333-8333-333333333004',
    'Công xã Paris', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7798, 106.6990,
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1600&q=80',
    null, 1, 30, 0, 20000, 'active', 'editorial', true, 0.70, 0.75
  ),
  (
    '44444444-4444-4444-8444-444444444010',
    'buu-dien-trung-tam-sai-gon',
    'Bưu điện Trung tâm Sài Gòn',
    'Nội thất thuộc địa còn dùng được, mát và lạ so với phố ngoài.',
    'Bưu điện vẫn hoạt động. Trần cao, bản đồ cũ, quầy gỗ. Vào đây thường giảm được 5–10 độ so với nắng Nam Kỳ Khởi Nghĩa. Nhiều người tới chụp ảnh rồi đi; nếu đứng lâu hơn sẽ thấy đây là chỗ nghỉ chân bất ngờ giữa vòng tham quan trung tâm.',
    '33333333-3333-4333-8333-333333333004',
    '2 Công xã Paris', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7799, 106.6998,
    'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1600&q=80',
    null, 1, 25, 0, 30000, 'active', 'editorial', true, 0.80, 0.83
  ),
  (
    '44444444-4444-4444-8444-444444444011',
    'duong-sach-nguyen-van-binh',
    'Đường sách Nguyễn Văn Bình',
    'Phố sách râm, hợp đọc và ngồi nói chuyện nhỏ.',
    'Con đường greenery giữa trung tâm, nhà sách và quán nhỏ. Buổi sáng và đầu giờ chiều dễ chịu. Cuối tuần có sự kiện, đông hơn. Đây là lựa chọn tốt khi muốn cảm giác văn hóa nhẹ, không nặng như bảo tàng, cũng không ồn như phố đi bộ Nguyễn Huệ.',
    '33333333-3333-4333-8333-333333333010',
    'Nguyễn Văn Bình', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7805, 106.6996,
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1600&q=80',
    null, 1, 45, 30000, 120000, 'active', 'editorial', true, 0.83, 0.81
  ),
  (
    '44444444-4444-4444-8444-444444444012',
    'cho-ben-thanh',
    'Chợ Bến Thành',
    'Đông, nóng, nhiều lựa chọn — hợp khi muốn nhịp thành phố.',
    'Bến Thành là chợ du lịch đúng nghĩa: mặc cả, hàng lưu niệm, ẩm thực. Không phải nơi an yên. Nếu chọn mood hào hứng hoặc muốn hiểu mật độ Sài Gòn, đây là tín hiệu rõ. Nên đi vào buổi sáng sớm. Ăn trong chợ tiện nhưng không phải trải nghiệm tinh tế.',
    '33333333-3333-4333-8333-333333333006',
    'Lê Lợi', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7720, 106.6983,
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80',
    null, 2, 60, 80000, 250000, 'active', 'editorial', true, 0.68, 0.72
  ),
  (
    '44444444-4444-4444-8444-444444444013',
    'pho-di-bo-nguyen-hue',
    'Phố đi bộ Nguyễn Huệ',
    'Trục mở của trung tâm, đẹp nhất lúc chạng vạng.',
    'Nguyễn Huệ rộng, nhìn thẳng ra sông. Ban ngày nắng gắt. Chiều tối đèn lên, gia đình, bạn trẻ, người bán hàng rong. Hợp đi bộ không mục tiêu, không hợp khi đang quá tải vì đám đông và âm thanh. Kết hợp tốt với café hoặc rooftop gần đó.',
    '33333333-3333-4333-8333-333333333010',
    'Nguyễn Huệ', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7743, 106.7037,
    'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1600&q=80',
    null, 1, 40, 0, 80000, 'active', 'editorial', true, 0.73, 0.74
  ),
  (
    '44444444-4444-4444-8444-444444444014',
    'pizza-4ps-le-thanh-ton',
    'Pizza 4P''s Lê Thánh Tôn',
    'Bàn gần nhau, pizza phô mai nhà làm, hợp nhóm bạn hoặc hẹn nhẹ.',
    '4P''s Lê Thánh Tôn thường phải chờ. Không gian sáng, mở, mùi lò nướng. Đây là chỗ “đáng chờ” với nhiều người vì chất lượng ổn định hơn là vì yên tĩnh. Cuối tuần ồn. Nếu đi hai người, xin bàn góc. Chi phí thuộc nhóm mid-range Quận 1.',
    '33333333-3333-4333-8333-333333333005',
    '8 Lê Thánh Tôn', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7766, 106.7034,
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&q=80',
    'https://pizza4ps.com', 3, 90, 250000, 450000, 'active', 'editorial', true, 0.82, 0.85
  ),
  (
    '44444444-4444-4444-8444-444444444015',
    'the-deck-saigon',
    'The Deck Saigon',
    'Bên sông Thảo Điền, ánh sáng chiều, hợp bữa tối hai người.',
    'The Deck nhìn ra sông Sài Gòn, cách trung tâm một đoạn về Thảo Điền. Gió sông làm dịu thành phố. Giá cao hơn phố. Hợp khi muốn chậm và có khoảng cách với ồn ào Quận 1. Đặt bàn gần sông trước; trong nhà mất đi lý do chính để tới.',
    '33333333-3333-4333-8333-333333333005',
    '38 Nguyễn Ư Dĩ', 'Thảo Điền', 'TP. Hồ Chí Minh', 'VN',
    10.8056, 106.7374,
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1600&q=80',
    'https://thedecksaigon.com', 4, 120, 600000, 1500000, 'active', 'editorial', true, 0.87, 0.86
  ),
  (
    '44444444-4444-4444-8444-444444444016',
    'com-tam-ba-ghien',
    'Cơm tấm Ba Ghiền',
    'Cơm tấm Sài Gòn quen, đông, nhanh, vị rõ.',
    'Ba Ghiền là chỗ ăn no, không phải chỗ ngồi lâu. Sườn, bì, chả, mỡ hành. Tối đông, phải chờ. Phù hợp khi đói và muốn vị Sài Gòn không diễn. Không hợp hẹn lãng mạn hay làm việc. Chi phí thấp, trải nghiệm trung thực.',
    '33333333-3333-4333-8333-333333333005',
    '84 Đặng Văn Ngữ', 'Phú Nhuận', 'TP. Hồ Chí Minh', 'VN',
    10.7978, 106.6756,
    'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=1600&q=80',
    null, 1, 40, 50000, 90000, 'active', 'editorial', true, 0.76, 0.80
  ),
  (
    '44444444-4444-4444-8444-444444444017',
    'landmark-81-skyview',
    'Landmark 81 SkyView',
    'Nhìn thành phố từ trên cao — hồi hộp nhẹ, cảm giác lớn.',
    'SkyView cho một góc nhìn mà ở mặt đất Sài Gòn không có: sông, khu Thảo Điền, trời chiều. Cần vé, cần thang máy, có lúc xếp hàng. Hợp khi muốn được “nhấc” khỏi mật độ phố. Không phải trải nghiệm dài; 45–70 phút là đủ. Hoàng hôn đáng hơn ban ngày.',
    '33333333-3333-4333-8333-333333333007',
    '720A Điện Biên Phủ', 'Bình Thạnh', 'TP. Hồ Chí Minh', 'VN',
    10.7951, 106.7219,
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&q=80',
    null, 3, 60, 200000, 400000, 'active', 'editorial', true, 0.79, 0.77
  ),
  (
    '44444444-4444-4444-8444-444444444018',
    'chill-skybar',
    'Chill Skybar',
    'Rooftop trung tâm, đèn thành phố, hợp tối và nhóm nhỏ.',
    'Chill nằm trên cao ở Abel, nhìn về phía sông và Bitexco. Cocktail và gió. Cuối tuần đông, nhạc vừa. Giá đồ uống thuộc nhóm cao. Hợp mood hào hứng hoặc lãng mạn buổi tối; không hợp khi đang quá tải vì vẫn có nhịp bar. Nên tới lúc trời vừa tối.',
    '33333333-3333-4333-8333-333333333008',
    '76A Lê Lai', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7706, 106.6937,
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600&q=80',
    'https://chillsaigon.com', 4, 120, 350000, 900000, 'active', 'editorial', true, 0.75, 0.74
  ),
  (
    '44444444-4444-4444-8444-444444444019',
    'lapothiquaire-district-1',
    'L''Apothiquaire Spa',
    'Spa lâu năm ở trung tâm, hợp khi cơ thể cần được tắt.',
    'Không gian nhà cũ, mùi thảo mộc, ánh sáng thấp. L''Apothiquaire phù hợp khi mood là nạp năng lượng theo hướng nghỉ chứ không phải cà phê. Đặt lịch trước. Trải nghiệm im, ít nói. Sau đó bước ra phố sẽ thấy tương phản rất rõ — đó cũng là một phần giá trị.',
    '33333333-3333-4333-8333-333333333009',
    '64A Trương Định', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7774, 106.6938,
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1600&q=80',
    'https://lapothiquaire.com', 4, 90, 500000, 1200000, 'active', 'editorial', true, 0.85, 0.84
  ),
  (
    '44444444-4444-4444-8444-444444444020',
    'cong-vien-23-9',
    'Công viên 23/9',
    'Dải xanh gần Bến Thành, hợp chờ giờ hoặc ngồi ngắn.',
    'Công viên 23/9 nằm giữa ga và chợ, nên không bao giờ thực sự yên. Vẫn là chỗ ngồi đất hiếm ở trung tâm khi chân mỏi. Buổi tối có người bán hàng và nhóm bạn. Hợp nghỉ ngắn, không hợp picnic dài. An yên hơn phố nhưng kém Tao Đàn.',
    '33333333-3333-4333-8333-333333333002',
    'Phạm Ngũ Lão', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7686, 106.6920,
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600&q=80',
    null, 1, 30, 0, 20000, 'active', 'editorial', true, 0.60, 0.62
  ),
  (
    '44444444-4444-4444-8444-444444444021',
    'secret-garden-rooftop',
    'Secret Garden',
    'Vườn trên tầng, đèn dây, hợp bữa tối chậm hai người.',
    'Secret Garden mang cảm giác được giấu trên cao so với hẻm phía dưới. Cây, đèn, bàn nhỏ. Đồ ăn Việt hiện đại, không phải fine dining. Hợp mood lãng mạn với ngân sách trung. Cuối tuần kín bàn. Ban ngày ít ma thuật hơn tối.',
    '33333333-3333-4333-8333-333333333005',
    '158/4 Pasteur', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7784, 106.6957,
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80',
    null, 3, 100, 250000, 550000, 'active', 'editorial', true, 0.80, 0.78
  ),
  (
    '44444444-4444-4444-8444-444444444022',
    'oromia-coffee',
    'Oromia Coffee',
    'Specialty coffee Ethiopian, bàn ít, phù hợp tập trung.',
    'Oromia nghiêng về hạt và chiết xuất hơn là concept. Không gian gọn, ít trang trí. Người tới chủ yếu vì cà phê và để đầu óc ở yên. Không phải chỗ check-in. Nếu đang tìm “an yên + tập trung” trong bán kính Quận 1, đây là tín hiệu tốt hơn các quán lớn.',
    '33333333-3333-4333-8333-333333333001',
    'Khu vực Đa Kao', 'Quận 1', 'TP. Hồ Chí Minh', 'VN',
    10.7872, 106.6994,
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1600&q=80',
    null, 3, 80, 60000, 130000, 'active', 'editorial', true, 0.77, 0.82
  )
on conflict (id) do nothing;

-- Editorial mood associations (cold-start ranking)
insert into public.place_moods (place_id, mood_id, weight, source) values
  ('44444444-4444-4444-8444-444444444001', '11111111-1111-4111-8111-111111111001', 0.9, 'editorial'),
  ('44444444-4444-4444-8444-444444444001', '11111111-1111-4111-8111-111111111007', 1.0, 'editorial'),
  ('44444444-4444-4444-8444-444444444001', '11111111-1111-4111-8111-111111111002', 0.6, 'editorial'),
  ('44444444-4444-4444-8444-444444444002', '11111111-1111-4111-8111-111111111004', 0.9, 'editorial'),
  ('44444444-4444-4444-8444-444444444002', '11111111-1111-4111-8111-111111111005', 0.5, 'editorial'),
  ('44444444-4444-4444-8444-444444444003', '11111111-1111-4111-8111-111111111003', 0.8, 'editorial'),
  ('44444444-4444-4444-8444-444444444003', '11111111-1111-4111-8111-111111111004', 0.6, 'editorial'),
  ('44444444-4444-4444-8444-444444444004', '11111111-1111-4111-8111-111111111001', 1.0, 'editorial'),
  ('44444444-4444-4444-8444-444444444004', '11111111-1111-4111-8111-111111111007', 0.7, 'editorial'),
  ('44444444-4444-4444-8444-444444444005', '11111111-1111-4111-8111-111111111001', 1.0, 'editorial'),
  ('44444444-4444-4444-8444-444444444005', '11111111-1111-4111-8111-111111111002', 0.9, 'editorial'),
  ('44444444-4444-4444-8444-444444444006', '11111111-1111-4111-8111-111111111001', 0.7, 'editorial'),
  ('44444444-4444-4444-8444-444444444006', '11111111-1111-4111-8111-111111111004', 0.8, 'editorial'),
  ('44444444-4444-4444-8444-444444444007', '11111111-1111-4111-8111-111111111003', 1.0, 'editorial'),
  ('44444444-4444-4444-8444-444444444007', '11111111-1111-4111-8111-111111111007', 0.6, 'editorial'),
  ('44444444-4444-4444-8444-444444444008', '11111111-1111-4111-8111-111111111003', 1.0, 'editorial'),
  ('44444444-4444-4444-8444-444444444009', '11111111-1111-4111-8111-111111111003', 0.6, 'editorial'),
  ('44444444-4444-4444-8444-444444444009', '11111111-1111-4111-8111-111111111004', 0.7, 'editorial'),
  ('44444444-4444-4444-8444-444444444010', '11111111-1111-4111-8111-111111111003', 0.8, 'editorial'),
  ('44444444-4444-4444-8444-444444444010', '11111111-1111-4111-8111-111111111001', 0.5, 'editorial'),
  ('44444444-4444-4444-8444-444444444011', '11111111-1111-4111-8111-111111111007', 0.9, 'editorial'),
  ('44444444-4444-4444-8444-444444444011', '11111111-1111-4111-8111-111111111001', 0.8, 'editorial'),
  ('44444444-4444-4444-8444-444444444012', '11111111-1111-4111-8111-111111111005', 1.0, 'editorial'),
  ('44444444-4444-4444-8444-444444444012', '11111111-1111-4111-8111-111111111004', 0.6, 'editorial'),
  ('44444444-4444-4444-8444-444444444013', '11111111-1111-4111-8111-111111111005', 0.8, 'editorial'),
  ('44444444-4444-4444-8444-444444444013', '11111111-1111-4111-8111-111111111006', 0.5, 'editorial'),
  ('44444444-4444-4444-8444-444444444014', '11111111-1111-4111-8111-111111111004', 0.8, 'editorial'),
  ('44444444-4444-4444-8444-444444444014', '11111111-1111-4111-8111-111111111006', 0.5, 'editorial'),
  ('44444444-4444-4444-8444-444444444015', '11111111-1111-4111-8111-111111111006', 1.0, 'editorial'),
  ('44444444-4444-4444-8444-444444444015', '11111111-1111-4111-8111-111111111001', 0.7, 'editorial'),
  ('44444444-4444-4444-8444-444444444016', '11111111-1111-4111-8111-111111111004', 0.7, 'editorial'),
  ('44444444-4444-4444-8444-444444444016', '11111111-1111-4111-8111-111111111005', 0.4, 'editorial'),
  ('44444444-4444-4444-8444-444444444017', '11111111-1111-4111-8111-111111111005', 0.9, 'editorial'),
  ('44444444-4444-4444-8444-444444444017', '11111111-1111-4111-8111-111111111003', 0.8, 'editorial'),
  ('44444444-4444-4444-8444-444444444018', '11111111-1111-4111-8111-111111111006', 0.8, 'editorial'),
  ('44444444-4444-4444-8444-444444444018', '11111111-1111-4111-8111-111111111005', 0.7, 'editorial'),
  ('44444444-4444-4444-8444-444444444019', '11111111-1111-4111-8111-111111111002', 1.0, 'editorial'),
  ('44444444-4444-4444-8444-444444444019', '11111111-1111-4111-8111-111111111001', 0.8, 'editorial'),
  ('44444444-4444-4444-8444-444444444020', '11111111-1111-4111-8111-111111111002', 0.4, 'editorial'),
  ('44444444-4444-4444-8444-444444444020', '11111111-1111-4111-8111-111111111004', 0.5, 'editorial'),
  ('44444444-4444-4444-8444-444444444021', '11111111-1111-4111-8111-111111111006', 0.95, 'editorial'),
  ('44444444-4444-4444-8444-444444444021', '11111111-1111-4111-8111-111111111001', 0.6, 'editorial'),
  ('44444444-4444-4444-8444-444444444022', '11111111-1111-4111-8111-111111111007', 1.0, 'editorial'),
  ('44444444-4444-4444-8444-444444444022', '11111111-1111-4111-8111-111111111001', 0.7, 'editorial')
on conflict do nothing;

insert into public.place_styles (place_id, style_id) values
  ('44444444-4444-4444-8444-444444444001', '22222222-2222-4222-8222-222222222002'),
  ('44444444-4444-4444-8444-444444444002', '22222222-2222-4222-8222-222222222002'),
  ('44444444-4444-4444-8444-444444444003', '22222222-2222-4222-8222-222222222002'),
  ('44444444-4444-4444-8444-444444444004', '22222222-2222-4222-8222-222222222002'),
  ('44444444-4444-4444-8444-444444444004', '22222222-2222-4222-8222-222222222008'),
  ('44444444-4444-4444-8444-444444444005', '22222222-2222-4222-8222-222222222001'),
  ('44444444-4444-4444-8444-444444444006', '22222222-2222-4222-8222-222222222001'),
  ('44444444-4444-4444-8444-444444444007', '22222222-2222-4222-8222-222222222004'),
  ('44444444-4444-4444-8444-444444444008', '22222222-2222-4222-8222-222222222004'),
  ('44444444-4444-4444-8444-444444444009', '22222222-2222-4222-8222-222222222004'),
  ('44444444-4444-4444-8444-444444444010', '22222222-2222-4222-8222-222222222004'),
  ('44444444-4444-4444-8444-444444444011', '22222222-2222-4222-8222-222222222004'),
  ('44444444-4444-4444-8444-444444444012', '22222222-2222-4222-8222-222222222003'),
  ('44444444-4444-4444-8444-444444444013', '22222222-2222-4222-8222-222222222005'),
  ('44444444-4444-4444-8444-444444444014', '22222222-2222-4222-8222-222222222003'),
  ('44444444-4444-4444-8444-444444444015', '22222222-2222-4222-8222-222222222003'),
  ('44444444-4444-4444-8444-444444444016', '22222222-2222-4222-8222-222222222003'),
  ('44444444-4444-4444-8444-444444444017', '22222222-2222-4222-8222-222222222005'),
  ('44444444-4444-4444-8444-444444444018', '22222222-2222-4222-8222-222222222006'),
  ('44444444-4444-4444-8444-444444444019', '22222222-2222-4222-8222-222222222007'),
  ('44444444-4444-4444-8444-444444444020', '22222222-2222-4222-8222-222222222001'),
  ('44444444-4444-4444-8444-444444444021', '22222222-2222-4222-8222-222222222003'),
  ('44444444-4444-4444-8444-444444444021', '22222222-2222-4222-8222-222222222008'),
  ('44444444-4444-4444-8444-444444444022', '22222222-2222-4222-8222-222222222002')
on conflict do nothing;
