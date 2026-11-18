package com.elearning.learning.service;

import com.elearning.learning.dto.ToeicModels.*;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
public class ToeicDictionaryService {

    private static final Logger log = LoggerFactory.getLogger(ToeicDictionaryService.class);

    // Matches lines like: passenger (n) hành khách  OR  meeting notes (n-n) ghi chú cuộc họp
    private static final Pattern VOCAB_LINE = Pattern.compile(
        "^[•\\-*\\s]*([A-Za-z][A-Za-z0-9'\\-‑\\s]{0,44}?)\\s*\\(([^)]{1,24})\\)\\s*[:\\-]?\\s*(.+)$"
    );
    // Matches option lines like: • (A) connectivity: danh từ (sự kết nối)
    private static final Pattern OPTION_LINE = Pattern.compile(
        "^[•\\-*\\s]*\\([A-D]\\)\\s*([A-Za-z][A-Za-z0-9'\\-‑\\s]{0,40}?)\\s*:\\s*([^(\\n]{1,35})\\(([^)\\n]+)\\)\\s*$"
    );

    private final JsonMapper mapper;
    private final Map<String, StoredWord> index = new ConcurrentHashMap<>();

    public ToeicDictionaryService(JsonMapper mapper) {
        this.mapper = mapper;
    }

    @PostConstruct
    void init() {
        seedCoreLexicon();
        loadFromToeicSeed();
    }

    public DictionaryEntry lookup(String rawTerm) {
        String cleaned = sanitize(rawTerm);
        if (cleaned.isEmpty()) {
            return new DictionaryEntry("", "", null, List.of(), List.of(), false);
        }
        List<String> candidates = candidateKeys(cleaned);
        StoredWord match = null;
        String matchedKey = cleaned;
        for (String candidate : candidates) {
            StoredWord found = index.get(candidate);
            if (found != null) {
                match = found;
                matchedKey = candidate;
                break;
            }
        }
        if (match == null) {
            return new DictionaryEntry(cleaned, cleaned, null, List.of(), relatedInIndex(cleaned), false);
        }
        List<DictionaryMeaning> meanings = new ArrayList<>(match.meanings.values());
        return new DictionaryEntry(
            cleaned,
            match.headword,
            match.phonetic,
            meanings.size() > 5 ? meanings.subList(0, 5) : meanings,
            relatedInIndex(matchedKey),
            true
        );
    }

    private List<String> relatedInIndex(String base) {
        if (base.length() < 3 || base.contains(" ")) return List.of();
        String stem = base.length() > 5 ? base.substring(0, base.length() - 1) : base;
        Set<String> related = new LinkedHashSet<>();
        for (String suffix : List.of(
            "",
            "s",
            "es",
            "ed",
            "ing",
            "ly",
            "er",
            "ion",
            "tion",
            "ment",
            "able",
            "ive",
            "al"
        )) {
            String probe = base + suffix;
            if (!probe.equals(base) && index.containsKey(probe)) related.add(probe);
        }
        if (related.size() < 5) {
            for (String key : index.keySet()) {
                if (
                    !key.equals(base) &&
                    !key.contains(" ") &&
                    key.startsWith(stem) &&
                    Math.abs(key.length() - base.length()) <= 5
                ) {
                    related.add(key);
                    if (related.size() >= 6) break;
                }
            }
        }
        return new ArrayList<>(related);
    }

    private void loadFromToeicSeed() {
        try {
            var resource = new ClassPathResource("toeic/ets2024-reading.json");
            if (!resource.exists()) return;
            try (var input = resource.getInputStream()) {
                List<Definition> exams = mapper.readValue(input, new TypeReference<List<Definition>>() {});
                for (Definition exam : exams) {
                    if (exam.questions() == null) continue;
                    for (Question question : exam.questions()) {
                        indexQuestion(question);
                    }
                }
            }
            log.info("Indexed {} TOEIC dictionary entries", index.size());
        } catch (Exception ex) {
            log.warn("Could not index TOEIC vocabulary from classpath resource", ex);
        }
    }

    private void indexQuestion(Question question) {
        String explanation = question.explanation();
        if (explanation == null || explanation.isBlank()) return;

        String correctText = "";
        if (question.options() != null && question.correctOptionId() != null) {
            for (Option option : question.options()) {
                if (question.correctOptionId().equals(option.id()) && option.text() != null) {
                    correctText = option.text().trim();
                    break;
                }
            }
        }
        String exampleEn =
            question.prompt() == null
                ? null
                : question
                      .prompt()
                      .replaceAll("-{3,}|—", correctText.isEmpty() ? "___" : correctText)
                      .replaceAll("\\s+", " ")
                      .trim();

        String exampleVi = extractTranslation(explanation);

        for (String rawLine : explanation.split("\\R")) {
            String line = rawLine.trim();
            if (line.isEmpty()) continue;

            Matcher optionMatcher = OPTION_LINE.matcher(line);
            if (optionMatcher.matches()) {
                String term = sanitize(optionMatcher.group(1));
                String pos = normalizePos(optionMatcher.group(2).trim());
                String meaningVi = optionMatcher.group(3).trim();
                addEntry(term, null, pos, meaningVi, exampleEn, exampleVi);
                continue;
            }

            Matcher vocabMatcher = VOCAB_LINE.matcher(line);
            if (vocabMatcher.matches()) {
                String term = sanitize(vocabMatcher.group(1));
                String pos = normalizePos(vocabMatcher.group(2).trim());
                String meaningVi = vocabMatcher.group(3).trim();
                if (!term.isEmpty() && meaningVi.length() >= 2 && meaningVi.length() <= 180) {
                    addEntry(term, null, pos, meaningVi, exampleEn, exampleVi);
                }
            }
        }
    }

    private static String extractTranslation(String explanation) {
        int idx = explanation.indexOf("Tạm dịch:");
        if (idx < 0) return null;
        String tail = explanation.substring(idx + "Tạm dịch:".length()).trim();
        int vocabIdx = tail.indexOf("Từ vựng");
        if (vocabIdx >= 0) tail = tail.substring(0, vocabIdx).trim();
        String singleLine = tail.replaceAll("\\s+", " ").trim();
        return singleLine.isEmpty() || singleLine.length() > 300 ? null : singleLine;
    }

    private void addEntry(
        String rawTerm,
        String phonetic,
        String pos,
        String meaningVi,
        String exampleEn,
        String exampleVi
    ) {
        String key = sanitize(rawTerm);
        if (key.isEmpty() || key.length() > 45) return;
        StoredWord word = index.computeIfAbsent(key, k -> new StoredWord(k, phonetic));
        if (word.phonetic == null && phonetic != null) word.phonetic = phonetic;
        String dedupKey = (pos + "|" + meaningVi.toLowerCase(Locale.ROOT)).trim();
        word.meanings.putIfAbsent(dedupKey, new DictionaryMeaning(pos, meaningVi, exampleEn, exampleVi));
    }

    private static String sanitize(String value) {
        if (value == null) return "";
        return value
            .replace('‑', '-')
            .replace('–', '-')
            .replace('’', '\'')
            .replaceAll("^[^A-Za-z]+|[^A-Za-z]+$", "")
            .replaceAll("\\s+", " ")
            .trim()
            .toLowerCase(Locale.ROOT);
    }

    private static String normalizePos(String raw) {
        String lower = raw.toLowerCase(Locale.ROOT).replace('‑', '-').trim();
        if (
            lower.contains("danh từ") || lower.equals("n") || lower.equals("noun") || lower.equals("n-n")
        ) return "Danh từ (n)";
        if (
            lower.contains("động từ") || lower.equals("v") || lower.equals("verb") || lower.startsWith("v ")
        ) return "Động từ (v)";
        if (
            lower.contains("tính từ") || lower.equals("adj") || lower.equals("adjective")
        ) return "Tính từ (adj)";
        if (
            lower.contains("trạng từ") || lower.equals("adv") || lower.equals("adverb")
        ) return "Trạng từ (adv)";
        if (
            lower.contains("giới từ") || lower.equals("prep") || lower.equals("preposition")
        ) return "Giới từ (prep)";
        if (
            lower.contains("liên từ") || lower.equals("conj") || lower.equals("conjunction")
        ) return "Liên từ (conj)";
        if (lower.contains("đại từ") || lower.equals("pron")) return "Đại từ (pron)";
        if (lower.contains("cụm") || lower.contains("phr")) return "Cụm từ (phr)";
        return raw;
    }

    private static List<String> candidateKeys(String word) {
        Set<String> list = new LinkedHashSet<>();
        list.add(word);
        Map<String, String> irregulars = Map.ofEntries(
            Map.entry("went", "go"),
            Map.entry("gone", "go"),
            Map.entry("wrote", "write"),
            Map.entry("written", "write"),
            Map.entry("took", "take"),
            Map.entry("taken", "take"),
            Map.entry("made", "make"),
            Map.entry("bought", "buy"),
            Map.entry("brought", "bring"),
            Map.entry("paid", "pay"),
            Map.entry("said", "say"),
            Map.entry("held", "hold"),
            Map.entry("kept", "keep"),
            Map.entry("built", "build"),
            Map.entry("sent", "send"),
            Map.entry("spent", "spend"),
            Map.entry("chose", "choose"),
            Map.entry("chosen", "choose"),
            Map.entry("spoke", "speak"),
            Map.entry("spoken", "speak"),
            Map.entry("began", "begin"),
            Map.entry("begun", "begin"),
            Map.entry("led", "lead"),
            Map.entry("met", "meet"),
            Map.entry("sold", "sell"),
            Map.entry("told", "tell"),
            Map.entry("found", "find"),
            Map.entry("children", "child"),
            Map.entry("men", "man"),
            Map.entry("women", "woman")
        );
        if (irregulars.containsKey(word)) list.add(irregulars.get(word));
        if (word.endsWith("ies") && word.length() > 4) list.add(word.substring(0, word.length() - 3) + "y");
        if (word.endsWith("ied") && word.length() > 4) list.add(word.substring(0, word.length() - 3) + "y");
        if (word.endsWith("es") && word.length() > 4) {
            list.add(word.substring(0, word.length() - 2));
            list.add(word.substring(0, word.length() - 1));
        }
        if (word.endsWith("s") && !word.endsWith("ss") && word.length() > 3) {
            list.add(word.substring(0, word.length() - 1));
        }
        if (word.endsWith("ing") && word.length() > 5) {
            String stem = word.substring(0, word.length() - 3);
            list.add(stem);
            list.add(stem + "e");
            if (stem.length() >= 3 && stem.charAt(stem.length() - 1) == stem.charAt(stem.length() - 2)) {
                list.add(stem.substring(0, stem.length() - 1));
            }
        }
        if (word.endsWith("ed") && word.length() > 4) {
            String stem = word.substring(0, word.length() - 2);
            list.add(stem);
            list.add(word.substring(0, word.length() - 1));
            if (stem.length() >= 3 && stem.charAt(stem.length() - 1) == stem.charAt(stem.length() - 2)) {
                list.add(stem.substring(0, stem.length() - 1));
            }
        }
        if (word.endsWith("ly") && word.length() > 4) {
            String stem = word.substring(0, word.length() - 2);
            list.add(stem);
            if (stem.endsWith("i")) list.add(stem.substring(0, stem.length() - 1) + "y");
        }
        if (word.endsWith("er") && word.length() > 4) {
            list.add(word.substring(0, word.length() - 2));
            list.add(word.substring(0, word.length() - 1));
        }
        if (word.endsWith("est") && word.length() > 5) {
            list.add(word.substring(0, word.length() - 3));
            list.add(word.substring(0, word.length() - 2));
        }
        return new ArrayList<>(list);
    }

    private void seedCoreLexicon() {
        String[][] core = {
            {
                "accommodate",
                "/əˈkɒmədeɪt/",
                "Động từ (v)",
                "đáp ứng, chứa được, cung cấp chỗ ở",
                "The hotel can accommodate up to 500 conference guests.",
                "Khách sạn có thể phục vụ tối đa 500 khách dự hội nghị.",
            },
            {
                "accomplish",
                "/əˈkʌmplɪʃ/",
                "Động từ (v)",
                "hoàn thành, đạt được",
                "The team accomplished its quarterly sales target.",
                "Nhóm đã hoàn thành mục tiêu doanh số quý.",
            },
            {
                "accurate",
                "/ˈækjərət/",
                "Tính từ (adj)",
                "chính xác, chuẩn xác",
                "Please ensure all invoice figures are accurate.",
                "Vui lòng đảm bảo mọi số liệu trên hóa đơn đều chính xác.",
            },
            {
                "acquire",
                "/əˈkwaɪər/",
                "Động từ (v)",
                "mua lại, đạt được, tiếp thu",
                "The firm acquired a local logistics startup.",
                "Công ty đã mua lại một doanh nghiệp logistics địa phương.",
            },
            {
                "additional",
                "/əˈdɪʃənl/",
                "Tính từ (adj)",
                "bổ sung, thêm vào",
                "Additional seating will be provided in the main hall.",
                "Chỗ ngồi bổ sung sẽ được bố trí tại sảnh chính.",
            },
            {
                "advance",
                "/ədˈvɑːns/",
                "Danh từ (n)",
                "sự tiến bộ; đặt trước (in advance)",
                "Tickets must be reserved at least two days in advance.",
                "Vé phải được đặt trước ít nhất hai ngày.",
            },
            {
                "affordable",
                "/əˈfɔːrdəbl/",
                "Tính từ (adj)",
                "giá cả phải chăng, hợp túi tiền",
                "We offer affordable office supplies for small businesses.",
                "Chúng tôi cung cấp văn phòng phẩm giá phải chăng cho doanh nghiệp nhỏ.",
            },
            {
                "agenda",
                "/əˈdʒendə/",
                "Danh từ (n)",
                "chương trình nghị sự, nội dung cuộc họp",
                "A copy of the meeting agenda was attached to the email.",
                "Bản nội dung cuộc họp đã được đính kèm trong email.",
            },
            {
                "agreement",
                "/əˈɡriːmənt/",
                "Danh từ (n)",
                "hợp đồng, thỏa thuận",
                "Both parties signed the lease agreement yesterday.",
                "Cả hai bên đã ký hợp đồng thuê mặt bằng vào hôm qua.",
            },
            {
                "allocate",
                "/ˈæləkeɪt/",
                "Động từ (v)",
                "phân bổ, cấp phát",
                "More funds were allocated to product research.",
                "Nhiều ngân sách hơn đã được phân bổ cho nghiên cứu sản phẩm.",
            },
            {
                "alternative",
                "/ɔːlˈtɜːrnətɪv/",
                "Danh từ (n)",
                "phương án thay thế",
                "Commuters are advised to take alternative routes.",
                "Người đi làm được khuyên chọn các tuyến đường thay thế.",
            },
            {
                "announcement",
                "/əˈnaʊnsmənt/",
                "Danh từ (n)",
                "thông báo",
                "Please listen carefully to the boarding announcement.",
                "Vui lòng nghe kỹ thông báo lên máy bay.",
            },
            {
                "annual",
                "/ˈænjuəl/",
                "Tính từ (adj)",
                "hàng năm, thường niên",
                "The annual shareholders meeting takes place in May.",
                "Cuộc họp cổ đông thường niên diễn ra vào tháng Năm.",
            },
            {
                "applicant",
                "/ˈæplɪkənt/",
                "Danh từ (n)",
                "ứng viên nộp đơn",
                "Each applicant should submit two professional references.",
                "Mỗi ứng viên cần nộp hai thư giới thiệu chuyên môn.",
            },
            {
                "appointment",
                "/əˈpɔɪntmənt/",
                "Danh từ (n)",
                "cuộc hẹn; sự bổ nhiệm",
                "Call the front desk to reschedule your appointment.",
                "Hãy gọi quầy lễ tân để dời lịch hẹn của bạn.",
            },
            {
                "appreciate",
                "/əˈpriːʃieɪt/",
                "Động từ (v)",
                "đánh giá cao, trân trọng, cảm kích",
                "We appreciate your patience during the renovation.",
                "Chúng tôi trân trọng sự kiên nhẫn của quý khách trong thời gian cải tạo.",
            },
            {
                "appropriate",
                "/əˈproʊpriət/",
                "Tính từ (adj)",
                "phù hợp, thích hợp",
                "Please wear appropriate safety gear in the warehouse.",
                "Vui lòng mặc đồ bảo hộ phù hợp trong kho hàng.",
            },
            {
                "approval",
                "/əˈpruːvl/",
                "Danh từ (n)",
                "sự phê duyệt, chấp thuận",
                "Travel expenses require prior manager approval.",
                "Chi phí công tác cần có sự phê duyệt trước của quản lý.",
            },
            {
                "arrange",
                "/əˈreɪndʒ/",
                "Động từ (v)",
                "sắp xếp, thu xếp",
                "The assistant arranged airport transportation for the visitors.",
                "Trợ lý đã thu xếp xe đưa đón sân bay cho đoàn khách.",
            },
            {
                "assign",
                "/əˈsaɪn/",
                "Động từ (v)",
                "phân công, giao việc",
                "New interns will be assigned a mentor on their first day.",
                "Thực tập sinh mới sẽ được phân công người hướng dẫn ngay ngày đầu.",
            },
            {
                "assist",
                "/əˈsɪst/",
                "Động từ (v)",
                "hỗ trợ, giúp đỡ",
                "Customer care agents are ready to assist you.",
                "Nhân viên chăm sóc khách hàng luôn sẵn sàng hỗ trợ bạn.",
            },
            {
                "attend",
                "/əˈtend/",
                "Động từ (v)",
                "tham dự",
                "Over 200 engineers attended the technical workshop.",
                "Hơn 200 kỹ sư đã tham dự buổi hội thảo kỹ thuật.",
            },
            {
                "authorize",
                "/ˈɔːθəraɪz/",
                "Động từ (v)",
                "ủy quyền, cho phép",
                "Only department heads may authorize overtime pay.",
                "Chỉ trưởng bộ phận mới được phép duyệt lương làm thêm giờ.",
            },
            {
                "available",
                "/əˈveɪləbl/",
                "Tính từ (adj)",
                "có sẵn, rảnh, khả dụng",
                "Next-day delivery is available for online orders.",
                "Giao hàng ngày hôm sau có sẵn cho các đơn đặt trực tuyến.",
            },
            {
                "banquet",
                "/ˈbæŋkwɪt/",
                "Danh từ (n)",
                "buổi tiệc lớn, yến tiệc",
                "The awards banquet will be held in the grand ballroom.",
                "Tiệc trao giải sẽ được tổ chức tại khán phòng lớn.",
            },
            {
                "benefit",
                "/ˈbenɪfɪt/",
                "Danh từ (n)",
                "lợi ích, phúc lợi",
                "Full-time staff receive comprehensive health benefits.",
                "Nhân viên toàn thời gian được hưởng phúc lợi y tế toàn diện.",
            },
            {
                "beverage",
                "/ˈbevərɪdʒ/",
                "Danh từ (n)",
                "đồ uống, thức uống",
                "Complimentary beverages are served in the lounge.",
                "Đồ uống miễn phí được phục vụ tại phòng chờ.",
            },
            {
                "brochure",
                "/broʊˈʃʊr/",
                "Danh từ (n)",
                "ấn phẩm quảng cáo, tờ gấp giới thiệu",
                "Pick up a travel brochure at the visitor center.",
                "Hãy lấy một tờ giới thiệu du lịch tại trung tâm du khách.",
            },
            {
                "budget",
                "/ˈbʌdʒɪt/",
                "Danh từ (n)",
                "ngân sách",
                "The marketing campaign stayed well within budget.",
                "Chiến dịch tiếp thị nằm gọn trong ngân sách đề ra.",
            },
            {
                "candidate",
                "/ˈkændɪdət/",
                "Danh từ (n)",
                "ứng viên",
                "Three candidates were shortlisted for the director role.",
                "Ba ứng viên đã vào danh sách rút gọn cho vị trí giám đốc.",
            },
            {
                "career",
                "/kəˈrɪr/",
                "Danh từ (n)",
                "sự nghiệp, nghề nghiệp",
                "She spoke about her career experiences in publishing.",
                "Cô ấy chia sẻ về kinh nghiệm sự nghiệp trong ngành xuất bản.",
            },
            {
                "catalog",
                "/ˈkætəlɔːɡ/",
                "Danh từ (n)",
                "danh mục sản phẩm",
                "Our spring catalog features eco-friendly furniture.",
                "Danh mục mùa xuân của chúng tôi giới thiệu nội thất thân thiện môi trường.",
            },
            {
                "certificate",
                "/sərˈtɪfɪkət/",
                "Danh từ (n)",
                "giấy chứng nhận, chứng chỉ, phiếu quà tặng",
                "Participants receive a completion certificate.",
                "Người tham gia được nhận giấy chứng nhận hoàn thành.",
            },
            {
                "collaborate",
                "/kəˈlæbəreɪt/",
                "Động từ (v)",
                "hợp tác, cộng tác",
                "Designers collaborated closely with the engineering team.",
                "Các nhà thiết kế đã cộng tác chặt chẽ với đội kỹ thuật.",
            },
            {
                "colleague",
                "/ˈkɑːliːɡ/",
                "Danh từ (n)",
                "đồng nghiệp",
                "Ask a colleague to review the draft report.",
                "Hãy nhờ một đồng nghiệp xem lại bản dự thảo báo cáo.",
            },
            {
                "committee",
                "/kəˈmɪti/",
                "Danh từ (n)",
                "ủy ban, hội đồng",
                "The planning committee meets every Tuesday morning.",
                "Ban tổ chức họp vào mỗi sáng thứ Ba.",
            },
            {
                "compensate",
                "/ˈkɑːmpenseɪt/",
                "Động từ (v)",
                "đền bù, bồi thường, trả thù lao",
                "Passengers were compensated for the delayed flight.",
                "Hành khách đã được bồi thường vì chuyến bay bị trễ.",
            },
            {
                "complimentary",
                "/ˌkɑːmplɪˈmentri/",
                "Tính từ (adj)",
                "miễn phí (tặng kèm), ca ngợi",
                "Hotel guests enjoy a complimentary continental breakfast.",
                "Khách lưu trú được thưởng thức bữa sáng miễn phí.",
            },
            {
                "comply",
                "/kəmˈplaɪ/",
                "Động từ (v)",
                "tuân thủ (+ with)",
                "All factories must comply with environmental regulations.",
                "Mọi nhà máy phải tuân thủ các quy định về môi trường.",
            },
            {
                "comprehensive",
                "/ˌkɑːmprɪˈhensɪv/",
                "Tính từ (adj)",
                "toàn diện, bao quát",
                "A comprehensive audit will begin next Monday.",
                "Một cuộc kiểm toán toàn diện sẽ bắt đầu vào thứ Hai tới.",
            },
            {
                "conduct",
                "/kənˈdʌkt/",
                "Động từ (v)",
                "tiến hành, thực hiện",
                "We conducted a survey of 1,000 regular customers.",
                "Chúng tôi đã tiến hành khảo sát 1.000 khách hàng thân thiết.",
            },
            {
                "conference",
                "/ˈkɑːnfərəns/",
                "Danh từ (n)",
                "hội nghị",
                "Registration for the medical conference closes Friday.",
                "Đăng ký dự hội nghị y khoa sẽ đóng vào thứ Sáu.",
            },
            {
                "confirm",
                "/kənˈfɜːrm/",
                "Động từ (v)",
                "xác nhận",
                "Please reply to confirm your attendance.",
                "Vui lòng phản hồi để xác nhận sự tham dự của bạn.",
            },
            {
                "confidential",
                "/ˌkɑːnfɪˈdenʃl/",
                "Tính từ (adj)",
                "bảo mật, tuyệt mật",
                "Keep client financial records strictly confidential.",
                "Hãy giữ hồ sơ tài chính của khách hàng bảo mật tuyệt đối.",
            },
            {
                "considerable",
                "/kənˈsɪdərəbl/",
                "Tính từ (adj)",
                "đáng kể, lớn",
                "The new software saved a considerable amount of time.",
                "Phần mềm mới đã tiết kiệm một lượng thời gian đáng kể.",
            },
            {
                "Convenient".toLowerCase(Locale.ROOT),
                "/kənˈviːniənt/",
                "Tính từ (adj)",
                "thuận tiện, tiện lợi",
                "Choose a delivery window that is convenient for you.",
                "Hãy chọn khung giờ giao hàng thuận tiện cho bạn.",
            },
            {
                "deadline",
                "/ˈdedlaɪn/",
                "Danh từ (n)",
                "hạn chót",
                "The deadline for grant proposals has been extended.",
                "Hạn chót nộp đề xuất tài trợ đã được gia hạn.",
            },
            {
                "defect",
                "/ˈdiːfekt/",
                "Danh từ (n)",
                "lỗi sản phẩm, khuyết điểm",
                "Items with manufacturing defects may be exchanged.",
                "Sản phẩm có lỗi sản xuất có thể được đổi mới.",
            },
            {
                "delay",
                "/dɪˈleɪ/",
                "Động từ (v)",
                "trì hoãn, làm chậm trễ",
                "Heavy rain delayed the outdoor concert by an hour.",
                "Mưa lớn đã làm buổi hòa nhạc ngoài trời trễ một tiếng.",
            },
            {
                "demonstrate",
                "/ˈdemənstreɪt/",
                "Động từ (v)",
                "chứng minh, trình diễn, hướng dẫn",
                "Sales staff demonstrated the new espresso machine.",
                "Nhân viên bán hàng đã trình diễn máy pha cà phê mới.",
            },
            {
                "department",
                "/dɪˈpɑːrtmənt/",
                "Danh từ (n)",
                "phòng ban, bộ phận",
                "Contact the billing department with any questions.",
                "Hãy liên hệ phòng thanh toán nếu có bất kỳ thắc mắc nào.",
            },
            {
                "despite",
                "/dɪˈspaɪt/",
                "Giới từ (prep)",
                "mặc dù, bất chấp",
                "Sales grew steadily despite rising material costs.",
                "Doanh số vẫn tăng đều bất chấp chi phí nguyên liệu tăng.",
            },
            {
                "distribute",
                "/dɪˈstrɪbjuːt/",
                "Động từ (v)",
                "phân phối, phát",
                "Handouts were distributed before the lecture began.",
                "Tài liệu đã được phát trước khi bài giảng bắt đầu.",
            },
            {
                "durable",
                "/ˈdʊrəbl/",
                "Tính từ (adj)",
                "bền, lâu hỏng",
                "This travel backpack is made of durable nylon.",
                "Chiếc ba lô du lịch này được làm từ vải nylon bền chắc.",
            },
            {
                "efficient",
                "/ɪˈfɪʃnt/",
                "Tính từ (adj)",
                "hiệu quả, năng suất",
                "The upgraded heating system is much more energy efficient.",
                "Hệ thống sưởi nâng cấp tiết kiệm năng lượng hơn nhiều.",
            },
            {
                "eligible",
                "/ˈelɪdʒəbl/",
                "Tính từ (adj)",
                "đủ điều kiện, hợp lệ (+ for/to)",
                "Employees are eligible for paid leave after six months.",
                "Nhân viên đủ điều kiện nghỉ phép có lương sau sáu tháng.",
            },
            {
                "emphasize",
                "/ˈemfəsaɪz/",
                "Động từ (v)",
                "nhấn mạnh",
                "The director emphasized workplace safety standards.",
                "Giám đốc đã nhấn mạnh các tiêu chuẩn an toàn lao động.",
            },
            {
                "enclosed",
                "/ɪnˈkloʊzd/",
                "Tính từ (adj)",
                "được đính kèm, gửi kèm trong phong bì",
                "Please review the enclosed contract and sign below.",
                "Vui lòng xem hợp đồng gửi kèm và ký bên dưới.",
            },
            {
                "enhance",
                "/ɪnˈhæns/",
                "Động từ (v)",
                "nâng cao, cải thiện, tăng cường",
                "Updated lighting enhanced the store's atmosphere.",
                "Hệ thống đèn mới đã nâng tầm không gian cửa hàng.",
            },
            {
                "enroll",
                "/ɪnˈroʊl/",
                "Động từ (v)",
                "ghi danh, đăng ký tham gia",
                "Staff can enroll in the leadership seminar online.",
                "Nhân viên có thể đăng ký khóa hội thảo lãnh đạo trực tuyến.",
            },
            {
                "ensure",
                "/ɪnˈʃʊr/",
                "Động từ (v)",
                "đảm bảo, chắc chắn",
                "Lock all windows to ensure building security.",
                "Hãy khóa mọi cửa sổ để đảm bảo an ninh tòa nhà.",
            },
            {
                "equipment",
                "/ɪˈkwɪpmənt/",
                "Danh từ (n)",
                "trang thiết bị (không đếm được)",
                "Laboratory equipment is inspected every month.",
                "Thiết bị phòng thí nghiệm được kiểm tra hàng tháng.",
            },
            {
                "estimate",
                "/ˈestɪmeɪt/",
                "Danh từ (n)",
                "bảng báo giá ước tính; ước lượng",
                "The contractor provided a written cost estimate.",
                "Nhà thầu đã cung cấp bảng ước tính chi phí bằng văn bản.",
            },
            {
                "evaluate",
                "/ɪˈvæljueɪt/",
                "Động từ (v)",
                "đánh giá",
                "Managers evaluate team performance twice a year.",
                "Quản lý đánh giá hiệu suất nhóm hai lần mỗi năm.",
            },
            {
                "exceed",
                "/ɪkˈsiːd/",
                "Động từ (v)",
                "vượt quá",
                "Carry-on luggage must not exceed ten kilograms.",
                "Hành lý xách tay không được vượt quá mười ki-lô-gam.",
            },
            {
                "executive",
                "/ɪɡˈzekjətɪv/",
                "Danh từ (n)",
                "giám đốc điều hành, cấp quản trị",
                "Senior executives approved the expansion plan.",
                "Các lãnh đạo cấp cao đã thông qua kế hoạch mở rộng.",
            },
            {
                "expand",
                "/ɪkˈspænd/",
                "Động từ (v)",
                "mở rộng",
                "The bakery plans to expand into three neighboring cities.",
                "Tiệm bánh dự kiến mở rộng sang ba thành phố lân cận.",
            },
            {
                "experience",
                "/ɪkˈspɪriəns/",
                "Danh từ (n)",
                "kinh nghiệm, trải nghiệm",
                "Prior retail experience is preferred for this role.",
                "Ưu tiên có kinh nghiệm bán lẻ trước đó cho vị trí này.",
            },
            {
                "expire",
                "/ɪkˈspaɪər/",
                "Động từ (v)",
                "hết hạn",
                "Your membership card will expire at the end of June.",
                "Thẻ thành viên của bạn sẽ hết hạn vào cuối tháng Sáu.",
            },
            {
                "facility",
                "/fəˈsɪləti/",
                "Danh từ (n)",
                "cơ sở vật chất, tòa nhà, khu tiện ích",
                "Our manufacturing facility operates around the clock.",
                "Cơ sở sản xuất của chúng tôi vận hành suốt ngày đêm.",
            },
            {
                "feedback",
                "/ˈfiːdbæk/",
                "Danh từ (n)",
                "ý kiến phản hồi, góp ý",
                "Customer feedback helped us refine the mobile app.",
                "Phản hồi của khách hàng giúp chúng tôi hoàn thiện ứng dụng.",
            },
            {
                "flexible",
                "/ˈfleksəbl/",
                "Tính từ (adj)",
                "linh hoạt",
                "We offer flexible working hours for remote staff.",
                "Chúng tôi cung cấp giờ làm việc linh hoạt cho nhân sự từ xa.",
            },
            {
                "frequent",
                "/ˈfriːkwənt/",
                "Tính từ (adj)",
                "thường xuyên",
                "Frequent flyers earn bonus points on every trip.",
                "Khách bay thường xuyên tích điểm thưởng trên mỗi chuyến đi.",
            },
            {
                "fulfill",
                "/fʊlˈfɪl/",
                "Động từ (v)",
                "hoàn thành, đáp ứng (đơn hàng, yêu cầu)",
                "Warehouse staff work hard to fulfill orders promptly.",
                "Nhân viên kho làm việc chăm chỉ để xử lý đơn hàng nhanh chóng.",
            },
            {
                "guarantee",
                "/ˌɡærənˈtiː/",
                "Danh từ (n)",
                "sự bảo đảm, cam kết bảo hành",
                "Every watch comes with a two-year guarantee.",
                "Mỗi chiếc đồng hồ đều đi kèm cam kết bảo hành hai năm.",
            },
            {
                "guideline",
                "/ˈɡaɪdlaɪn/",
                "Danh từ (n)",
                "nguyên tắc hướng dẫn",
                "Follow the formatting guidelines when submitting articles.",
                "Hãy tuân theo hướng dẫn định dạng khi gửi bài viết.",
            },
            {
                "headquarters",
                "/ˈhedkwɔːrtərz/",
                "Danh từ (n)",
                "trụ sở chính",
                "Corporate headquarters relocated to downtown Osaka.",
                "Trụ sở chính của tập đoàn đã chuyển về trung tâm Osaka.",
            },
            {
                "implement",
                "/ˈɪmplɪment/",
                "Động từ (v)",
                "triển khai, áp dụng",
                "The hospital implemented a digital check-in system.",
                "Bệnh viện đã triển khai hệ thống làm thủ tục điện tử.",
            },
            {
                "improve",
                "/ɪmˈpruːv/",
                "Động từ (v)",
                "cải thiện, nâng cao",
                "New signage will improve traffic flow in the parking lot.",
                "Biển chỉ dẫn mới sẽ cải thiện luồng xe trong bãi đỗ.",
            },
            {
                "incentive",
                "/ɪnˈsentɪv/",
                "Danh từ (n)",
                "khoản khuyến khích, ưu đãi động viên",
                "Cash incentives are offered for employee referrals.",
                "Tiền thưởng khuyến khích được trao khi giới thiệu nhân sự.",
            },
            {
                "indicate",
                "/ˈɪndɪkeɪt/",
                "Động từ (v)",
                "chỉ ra, cho thấy",
                "Early reports indicate strong demand for the model.",
                "Các báo cáo ban đầu cho thấy nhu cầu cao đối với mẫu này.",
            },
            {
                "inquire",
                "/ɪnˈkwaɪər/",
                "Động từ (v)",
                "hỏi thông tin, tìm hiểu (+ about)",
                "Several clients called to inquire about bulk pricing.",
                "Nhiều khách hàng đã gọi để hỏi về giá mua sỉ.",
            },
            {
                "inspect",
                "/ɪnˈspekt/",
                "Động từ (v)",
                "kiểm tra, thanh tra",
                "Technicians inspect the elevators every quarter.",
                "Kỹ thuật viên kiểm tra thang máy hàng quý.",
            },
            {
                "install",
                "/ɪnˈstɔːl/",
                "Động từ (v)",
                "lắp đặt, cài đặt",
                "Solar panels were installed on the warehouse roof.",
                "Các tấm pin mặt trời đã được lắp đặt trên mái kho.",
            },
            {
                "instruction",
                "/ɪnˈstrʌkʃn/",
                "Danh từ (n)",
                "hướng dẫn, chỉ dẫn",
                "Read the assembly instructions carefully before starting.",
                "Hãy đọc kỹ hướng dẫn lắp ráp trước khi bắt đầu.",
            },
            {
                "inventory",
                "/ˈɪnvəntɔːri/",
                "Danh từ (n)",
                "hàng tồn kho, bảng kiểm kê",
                "Store clerks count inventory at the end of each month.",
                "Nhân viên cửa hàng kiểm kê hàng tồn vào cuối mỗi tháng.",
            },
            {
                "invoice",
                "/ˈɪnvɔɪs/",
                "Danh từ (n)",
                "hóa đơn thanh toán",
                "Payment is due within 30 days of the invoice date.",
                "Thanh toán đến hạn trong vòng 30 ngày kể từ ngày xuất hóa đơn.",
            },
            {
                "itinerary",
                "/aɪˈtɪnəreri/",
                "Danh từ (n)",
                "lịch trình chuyến đi",
                "An updated tour itinerary was sent to all travelers.",
                "Lịch trình tham quan cập nhật đã được gửi cho mọi du khách.",
            },
            {
                "launch",
                "/lɔːntʃ/",
                "Động từ (v)",
                "ra mắt, tung ra",
                "The company will launch its new skincare line in June.",
                "Công ty sẽ ra mắt dòng chăm sóc da mới vào tháng Sáu.",
            },
            {
                "maintenance",
                "/ˈmeɪntənəns/",
                "Danh từ (n)",
                "sự bảo trì, bảo dưỡng",
                "Server maintenance is scheduled for Sunday night.",
                "Việc bảo trì máy chủ được lên lịch vào tối Chủ nhật.",
            },
            {
                "mandatory",
                "/ˈmændətɔːri/",
                "Tính từ (adj)",
                "bắt buộc",
                "Attendance at the fire drill is mandatory for all staff.",
                "Việc tham gia diễn tập phòng cháy là bắt buộc với mọi nhân viên.",
            },
            {
                "merchandise",
                "/ˈmɜːrtʃəndaɪs/",
                "Danh từ (n)",
                "hàng hóa kinh doanh",
                "Sale merchandise cannot be returned for cash.",
                "Hàng giảm giá không được trả lại lấy tiền mặt.",
            },
            {
                "negotiate",
                "/nɪˈɡoʊʃieɪt/",
                "Động từ (v)",
                "đàm phán, thương lượng",
                "Our legal team negotiated favorable contract terms.",
                "Đội pháp lý của chúng tôi đã đàm phán các điều khoản thuận lợi.",
            },
            {
                "notify",
                "/ˈnoʊtɪfaɪ/",
                "Động từ (v)",
                "thông báo cho ai biết",
                "Winners will be notified by e-mail next week.",
                "Người chiến thắng sẽ được thông báo qua email vào tuần tới.",
            },
            {
                "obtain",
                "/əbˈteɪn/",
                "Động từ (v)",
                "đạt được, lấy được, xin được",
                "Visitors must obtain a pass at the security desk.",
                "Khách thăm phải lấy thẻ ra vào tại bàn bảo vệ.",
            },
            {
                "opportunity",
                "/ˌɑːpərˈtuːnəti/",
                "Danh từ (n)",
                "cơ hội",
                "The internship offers hands-on learning opportunities.",
                "Kỳ thực tập mang lại nhiều cơ hội học hỏi thực tế.",
            },
            {
                "participate",
                "/pɑːrˈtɪsɪpeɪt/",
                "Động từ (v)",
                "tham gia (+ in)",
                "Employees are encouraged to participate in wellness programs.",
                "Nhân viên được khuyến khích tham gia các chương trình sức khỏe.",
            },
            {
                "permanent",
                "/ˈpɜːrmənənt/",
                "Tính từ (adj)",
                "lâu dài, cố định, vĩnh viễn",
                "She was offered a permanent position after her probation.",
                "Cô ấy được mời làm vị trí chính thức sau thời gian thử việc.",
            },
            {
                "policy",
                "/ˈpɑːləsi/",
                "Danh từ (n)",
                "chính sách, quy định",
                "Please review our updated return policy online.",
                "Vui lòng xem chính sách đổi trả cập nhật của chúng tôi trên web.",
            },
            {
                "postpone",
                "/poʊˈspoʊn/",
                "Động từ (v)",
                "hoãn lại, dời lại",
                "The picnic was postponed until next Saturday.",
                "Buổi dã ngoại đã được dời lại sang thứ Bảy tuần sau.",
            },
            {
                "potential",
                "/pəˈtenʃl/",
                "Tính từ (adj)",
                "tiềm năng",
                "Representatives met with potential overseas distributors.",
                "Đại diện công ty đã gặp gỡ các nhà phân phối tiềm năng ở nước ngoài.",
            },
            {
                "prior",
                "/ˈpraɪər/",
                "Tính từ (adj)",
                "trước đó (+ to: trước khi)",
                "Check in at least one hour prior to departure.",
                "Làm thủ tục ít nhất một giờ trước giờ khởi hành.",
            },
            {
                "procedure",
                "/prəˈsiːdʒər/",
                "Danh từ (n)",
                "quy trình, thủ tục",
                "Follow standard safety procedures when operating machinery.",
                "Tuân thủ quy trình an toàn tiêu chuẩn khi vận hành máy móc.",
            },
            {
                "productive",
                "/prəˈdʌktɪv/",
                "Tính từ (adj)",
                "năng suất, hiệu quả",
                "We had a very productive brainstorming session.",
                "Chúng tôi đã có một buổi thảo luận ý tưởng rất hiệu quả.",
            },
            {
                "promote",
                "/prəˈmoʊt/",
                "Động từ (v)",
                "thăng chức; quảng bá, thúc đẩy",
                "Mr. Kim was promoted to regional sales director.",
                "Ông Kim đã được thăng chức làm giám đốc kinh doanh vùng.",
            },
            {
                "promptly",
                "/ˈprɑːmptli/",
                "Trạng từ (adv)",
                "nhanh chóng, đúng giờ, ngay lập tức",
                "The seminar will begin promptly at 9:00 A.M.",
                "Buổi hội thảo sẽ bắt đầu đúng 9 giờ sáng.",
            },
            {
                "proposal",
                "/prəˈpoʊzl/",
                "Danh từ (n)",
                "bản đề xuất, dự thảo",
                "Submit your project proposal by Wednesday afternoon.",
                "Hãy nộp bản đề xuất dự án trước chiều thứ Tư.",
            },
            {
                "purchase",
                "/ˈpɜːrtʃəs/",
                "Động từ (v)",
                "mua, thu mua; giao dịch mua",
                "Keep your receipt as proof of purchase.",
                "Hãy giữ biên lai làm bằng chứng mua hàng.",
            },
            {
                "qualified",
                "/ˈkwɑːlɪfaɪd/",
                "Tính từ (adj)",
                "đủ năng lực, đủ trình độ chuyên môn",
                "We are seeking a qualified accountant to join our firm.",
                "Chúng tôi đang tìm một kế toán viên đủ chuyên môn gia nhập công ty.",
            },
            {
                "receipt",
                "/rɪˈsiːt/",
                "Danh từ (n)",
                "biên lai, hóa đơn nhận tiền",
                "A digital receipt will be sent to your email address.",
                "Biên lai điện tử sẽ được gửi tới địa chỉ email của bạn.",
            },
            {
                "recommend",
                "/ˌrekəˈmend/",
                "Động từ (v)",
                "khuyên, giới thiệu, đề xuất",
                "Analysts recommend diversifying the product portfolio.",
                "Các nhà phân tích khuyến nghị đa dạng hóa danh mục sản phẩm.",
            },
            {
                "refund",
                "/ˈriːfʌnd/",
                "Danh từ (n)",
                "khoản tiền hoàn lại; hoàn tiền",
                "Unopened items qualify for a full refund.",
                "Sản phẩm chưa mở hộp đủ điều kiện được hoàn tiền toàn bộ.",
            },
            {
                "regarding",
                "/rɪˈɡɑːrdɪŋ/",
                "Giới từ (prep)",
                "về việc, liên quan đến",
                "I am writing regarding your recent job application.",
                "Tôi viết thư này liên quan đến đơn ứng tuyển gần đây của bạn.",
            },
            {
                "register",
                "/ˈredʒɪstər/",
                "Động từ (v)",
                "đăng ký",
                "Register early to receive the discounted conference rate.",
                "Đăng ký sớm để nhận mức phí hội nghị ưu đãi.",
            },
            {
                "reimburse",
                "/ˌriːɪmˈbɜːrs/",
                "Động từ (v)",
                "hoàn trả lại chi phí",
                "The company reimburses employees for business travel.",
                "Công ty hoàn trả chi phí đi công tác cho nhân viên.",
            },
            {
                "reliable",
                "/rɪˈlaɪəbl/",
                "Tính từ (adj)",
                "đáng tin cậy",
                "Public transit in the city is fast and reliable.",
                "Giao thông công cộng trong thành phố nhanh và đáng tin cậy.",
            },
            {
                "relocate",
                "/ˌriːˈloʊkeɪt/",
                "Động từ (v)",
                "chuyển địa điểm, dời chỗ",
                "Our clinic will relocate to Elm Street next month.",
                "Phòng khám của chúng tôi sẽ chuyển đến đường Elm vào tháng tới.",
            },
            {
                "renovate",
                "/ˈrenəveɪt/",
                "Động từ (v)",
                "cải tạo, tân trang, nâng cấp",
                "The historic theater was renovated last summer.",
                "Nhà hát lịch sử đã được tân trang vào mùa hè năm ngoái.",
            },
            {
                "replace",
                "/rɪˈpleɪs/",
                "Động từ (v)",
                "thay thế",
                "Worn machine parts should be replaced immediately.",
                "Các linh kiện máy bị mòn cần được thay thế ngay lập tức.",
            },
            {
                "representative",
                "/ˌreprɪˈzentətɪv/",
                "Danh từ (n)",
                "người đại diện, nhân viên tư vấn",
                "Speak with a customer service representative for help.",
                "Hãy trao đổi với nhân viên dịch vụ khách hàng để được hỗ trợ.",
            },
            {
                "request",
                "/rɪˈkwest/",
                "Danh từ (n)",
                "yêu cầu, lời đề nghị",
                "Maintenance requests can be submitted through the portal.",
                "Yêu cầu bảo trì có thể được gửi qua cổng thông tin.",
            },
            {
                "require",
                "/rɪˈkwaɪər/",
                "Động từ (v)",
                "yêu cầu, đòi hỏi",
                "International flights require a valid passport.",
                "Các chuyến bay quốc tế yêu cầu hộ chiếu còn hiệu lực.",
            },
            {
                "reservation",
                "/ˌrezərˈveɪʃn/",
                "Danh từ (n)",
                "sự đặt chỗ trước",
                "Dinner reservations are recommended on weekends.",
                "Nên đặt bàn ăn tối trước vào các ngày cuối tuần.",
            },
            {
                "resolve",
                "/rɪˈzɑːlv/",
                "Động từ (v)",
                "giải quyết, xử lý dứt điểm",
                "The IT team quickly resolved the network outage.",
                "Đội CNTT đã nhanh chóng khắc phục sự cố mất mạng.",
            },
            {
                "responsibility",
                "/rɪˌspɑːnsəˈbɪləti/",
                "Danh từ (n)",
                "trách nhiệm, nhiệm vụ",
                "Quality control is a shared responsibility across teams.",
                "Kiểm soát chất lượng là trách nhiệm chung của các bộ phận.",
            },
            {
                "retail",
                "/ˈriːteɪl/",
                "Danh từ (n)",
                "bán lẻ",
                "She has ten years of management experience in retail.",
                "Cô ấy có mười năm kinh nghiệm quản lý ngành bán lẻ.",
            },
            {
                "revise",
                "/rɪˈvaɪz/",
                "Động từ (v)",
                "chỉnh sửa, xem xét sửa đổi",
                "The editor asked the author to revise chapter three.",
                "Biên tập viên đề nghị tác giả chỉnh sửa lại chương ba.",
            },
            {
                "schedule",
                "/ˈskedʒuːl/",
                "Danh từ (n)",
                "lịch trình; lên lịch",
                "Production remains ahead of schedule this quarter.",
                "Tiến độ sản xuất vẫn vượt kế hoạch trong quý này.",
            },
            {
                "shipment",
                "/ˈʃɪpmənt/",
                "Danh từ (n)",
                "lô hàng, việc vận chuyển hàng",
                "A shipment of raw materials arrived this morning.",
                "Một lô nguyên vật liệu đã đến vào sáng nay.",
            },
            {
                "significant",
                "/sɪɡˈnɪfɪkənt/",
                "Tính từ (adj)",
                "đáng kể, quan trọng",
                "The update brought significant speed improvements.",
                "Bản cập nhật mang lại cải thiện tốc độ đáng kể.",
            },
            {
                "specify",
                "/ˈspesɪfaɪ/",
                "Động từ (v)",
                "nêu rõ, chỉ định cụ thể",
                "Please specify your preferred delivery date on the form.",
                "Vui lòng ghi rõ ngày giao hàng mong muốn trên biểu mẫu.",
            },
            {
                "submit",
                "/səbˈmɪt/",
                "Động từ (v)",
                "nộp, đệ trình",
                "All expense reports must be submitted by Friday.",
                "Mọi báo cáo chi phí phải được nộp trước thứ Sáu.",
            },
            {
                "substantial",
                "/səbˈstænʃl/",
                "Tính từ (adj)",
                "đáng kể, lớn lao",
                "Early investors received a substantial return.",
                "Các nhà đầu tư ban đầu nhận được khoản lợi nhuận đáng kể.",
            },
            {
                "sufficient",
                "/səˈfɪʃnt/",
                "Tính từ (adj)",
                "đầy đủ",
                "Allow sufficient time for airport security screening.",
                "Hãy dành đủ thời gian cho khâu kiểm tra an ninh sân bay.",
            },
            {
                "supervise",
                "/ˈsuːpərvaɪz/",
                "Động từ (v)",
                "giám sát, quản lý",
                "A site engineer will supervise the construction crew.",
                "Một kỹ sư công trường sẽ giám sát đội thi công.",
            },
            {
                "supplier",
                "/səˈplaɪər/",
                "Danh từ (n)",
                "nhà cung cấp",
                "We switched to a local packaging supplier.",
                "Chúng tôi đã chuyển sang một nhà cung cấp bao bì trong nước.",
            },
            {
                "temporary",
                "/ˈtempəreri/",
                "Tính từ (adj)",
                "tạm thời",
                "A temporary entrance is located on the north side.",
                "Lối vào tạm thời nằm ở phía bắc tòa nhà.",
            },
            {
                "thorough",
                "/ˈθɜːroʊ/",
                "Tính từ (adj)",
                "kỹ lưỡng, triệt để",
                "Mechanics performed a thorough safety check.",
                "Các thợ máy đã thực hiện kiểm tra an toàn kỹ lưỡng.",
            },
            {
                "transfer",
                "/trænsˈfɜːr/",
                "Động từ (v)",
                "chuyển công tác, chuyển khoản, chuyển tuyến",
                "Ms. Tran transferred to the Singapore branch office.",
                "Cô Trần đã chuyển công tác sang văn phòng chi nhánh Singapore.",
            },
            {
                "upcoming",
                "/ˈʌpkʌmɪŋ/",
                "Tính từ (adj)",
                "sắp tới, sắp diễn ra",
                "Details about upcoming workshops are posted online.",
                "Thông tin về các buổi hội thảo sắp tới được đăng trên mạng.",
            },
            {
                "upgrade",
                "/ˌʌpˈɡreɪd/",
                "Động từ (v)",
                "nâng cấp",
                "Passengers used miles to upgrade to business class.",
                "Hành khách dùng dặm bay để nâng hạng lên thương gia.",
            },
            {
                "valid",
                "/ˈvælɪd/",
                "Tính từ (adj)",
                "còn hiệu lực, hợp lệ",
                "The discount coupon is valid through December 31.",
                "Phiếu giảm giá có hiệu lực đến hết ngày 31 tháng 12.",
            },
            {
                "venue",
                "/ˈvenjuː/",
                "Danh từ (n)",
                "địa điểm tổ chức sự kiện",
                "The convention center is an ideal venue for trade shows.",
                "Trung tâm hội nghị là địa điểm lý tưởng cho triển lãm thương mại.",
            },
            {
                "verify",
                "/ˈverɪfaɪ/",
                "Động từ (v)",
                "xác minh, kiểm chứng",
                "Show photo identification to verify your account.",
                "Xuất trình giấy tờ tùy thân có ảnh để xác minh tài khoản.",
            },
            {
                "warranty",
                "/ˈwɔːrənti/",
                "Danh từ (n)",
                "giấy bảo hành, chế độ bảo hành",
                "Repairs are covered under the manufacturer's warranty.",
                "Chi phí sửa chữa nằm trong chế độ bảo hành của nhà sản xuất.",
            },
        };
        for (String[] row : core) {
            addEntry(row[0], row[1], row[2], row[3], row[4], row[5]);
        }
    }

    private static final class StoredWord {

        final String headword;
        volatile String phonetic;
        final Map<String, DictionaryMeaning> meanings = new LinkedHashMap<>();

        StoredWord(String headword, String phonetic) {
            this.headword = headword;
            this.phonetic = phonetic;
        }
    }
}
