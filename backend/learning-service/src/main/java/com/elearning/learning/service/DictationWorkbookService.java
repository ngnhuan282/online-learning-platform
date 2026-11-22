package com.elearning.learning.service;

import static com.elearning.learning.dto.DictationModels.LEVEL_PATTERN;

import com.elearning.learning.common.exception.DictationValidationException;
import com.elearning.learning.dto.DictationModels.*;
import java.io.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Pattern;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DictationWorkbookService {

    static final int MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
    private static final ClassPathResource TEMPLATE = new ClassPathResource("dictation/transcript-template.xlsx");
    private static final List<String> HEADERS = List.of("Thứ tự", "Transcript", "Bắt đầu", "Kết thúc");
    private static final String DURATION_LABEL = "Thời gian";
    private static final Set<String> LEGACY_DURATION_LABELS = Set.of("Thời lượng (mm:ss)", "Thời lượng (giây)");
    private static final List<String> LESSON_HEADERS = List.of(
        "Tên bài nghe", "Chủ đề", "Trình độ", "Link YouTube", DURATION_LABEL
    );
    private static final Pattern DURATION_CLOCK = Pattern.compile("([0-9]+):([0-5][0-9](?:\\.[0-9]+)?)");
    private static final Pattern TRANSCRIPT_CLOCK = Pattern.compile("([0-9]{2,3}):([0-5][0-9](?:\\.[0-9]+)?)");
    private static final int TRANSCRIPT_HEADER_ROW = LESSON_HEADERS.size() + 2;
    private static final String UNREADABLE_WORKBOOK =
        "Không đọc được file. Hãy dùng file Excel mẫu và không nhập công thức.";

    public byte[] template() {
        try (var input = TEMPLATE.getInputStream()) {
            return input.readAllBytes();
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot read transcript template", ex);
        }
    }

    byte[] writeLesson(Definition definition) {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Transcript");
            sheet.setColumnWidth(0, 24 * 256);
            sheet.setColumnWidth(1, 72 * 256);
            sheet.setColumnWidth(2, 14 * 256);
            sheet.setColumnWidth(3, 14 * 256);
            writeRow(sheet.createRow(0), "Thông tin bài nghe", "Nội dung");
            var video = definition.video();
            var values = List.of(
                definition.title(), definition.topic(), definition.level(), video.url(), workbookTime(video.duration())
            );
            for (int i = 0; i < LESSON_HEADERS.size(); i++) {
                writeRow(sheet.createRow(i + 1), LESSON_HEADERS.get(i), values.get(i));
            }
            writeRow(sheet.createRow(TRANSCRIPT_HEADER_ROW), HEADERS.toArray(String[]::new));
            for (int i = 0; i < definition.sentences().size(); i++) {
                Sentence sentence = definition.sentences().get(i);
                writeRow(
                    sheet.createRow(TRANSCRIPT_HEADER_ROW + i + 1),
                    String.valueOf(i + 1), sentence.text(), workbookTime(sentence.start()), workbookTime(sentence.end())
                );
            }
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException("Cannot write dictation workbook", ex);
        }
    }

    private static String workbookTime(double seconds) {
        var parts = BigDecimal.valueOf(seconds).divideAndRemainder(BigDecimal.valueOf(60));
        return String.format(Locale.ROOT, "%02d:%s%s", parts[0].intValueExact(),
            parts[1].compareTo(BigDecimal.TEN) < 0 ? "0" : "", parts[1].stripTrailingZeros().toPlainString());
    }

    private static void writeRow(Row row, String... values) {
        for (int i = 0; i < values.length; i++) {
            row.createCell(i).setCellValue(values[i]);
        }
    }

    public ImportResult parse(MultipartFile file) {
        if (
            file.isEmpty() ||
            file.getSize() > MAX_WORKBOOK_BYTES ||
            file.getOriginalFilename() == null ||
            !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx")
        ) throw new DictationValidationException("Vui lòng chọn file Excel .xlsx không quá 5 MB.");
        try (var workbook = new XSSFWorkbook(file.getInputStream())) {
            return transcript(workbook);
        } catch (DictationValidationException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new DictationValidationException(UNREADABLE_WORKBOOK);
        }
    }

    public Definition parseLesson(byte[] contents) {
        if (contents.length == 0 || contents.length > MAX_WORKBOOK_BYTES) {
            throw new DictationValidationException("Tệp Excel cần có dữ liệu và tối đa 5 MB.");
        }
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(contents))) {
            List<String> details = lessonFields(workbook);
            for (int field = 0; field < details.size(); field++) {
                if (details.get(field).isBlank()) {
                    throw new DictationValidationException("Chưa điền mục “" + LESSON_HEADERS.get(field) + "”.");
                }
            }
            String level = details.get(2).toUpperCase(Locale.ROOT);
            if (!level.matches(LEVEL_PATTERN)) {
                throw new DictationValidationException("Trình độ phải là A1, A2, B1, B2, C1 hoặc C2.");
            }
            String videoId = DictationService.youtubeVideoId(details.get(3));
            if (videoId == null) throw new DictationValidationException("Cần link YouTube HTTPS hợp lệ.");
            double duration = durationInSeconds(details.get(4));
            ImportResult imported = transcript(workbook);
            if (!imported.errors().isEmpty()) {
                ImportIssue issue = imported.errors().getFirst();
                throw new DictationValidationException("Transcript dòng " + issue.row() + " " + issue.message());
            }
            return new Definition(
                details.get(0),
                "",
                details.get(1),
                level,
                null,
                imported.sentences(),
                new Video("https://www.youtube.com/watch?v=" + videoId, duration)
            );
        } catch (DictationValidationException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new DictationValidationException(UNREADABLE_WORKBOOK);
        }
    }

    private List<String> lessonFields(Workbook workbook) {
        List<String> details = new ArrayList<>();
        Sheet transcript = workbook.getSheet("Transcript");
        if (transcript != null && transcriptHeaderRow(transcript) == TRANSCRIPT_HEADER_ROW) {
            for (int field = 0; field < LESSON_HEADERS.size(); field++) {
                Row row = transcript.getRow(field + 1);
                if (!lessonLabelMatches(field, value(row, 0))) {
                    throw new DictationValidationException("Giữ nguyên tên và thứ tự các mục thông tin bài nghe.");
                }
                details.add(value(row, 1));
            }
            return details;
        }

        Sheet previous = workbook.getSheet("Bài nghe");
        if (previous == null) {
            throw new DictationValidationException("Thiếu phần thông tin bài nghe. Hãy dùng file Excel mẫu mới.");
        }
        for (int col = 0; col < LESSON_HEADERS.size(); col++) {
            if (!lessonLabelMatches(col, value(previous.getRow(0), col))) {
                throw new DictationValidationException("Giữ nguyên tên và thứ tự cột trong sheet Bài nghe.");
            }
            details.add(value(previous.getRow(1), col));
        }
        return details;
    }

    private boolean lessonLabelMatches(int field, String label) {
        String expected = LESSON_HEADERS.get(field);
        return expected.equals(label) || (DURATION_LABEL.equals(expected) && LEGACY_DURATION_LABELS.contains(label));
    }

    private int transcriptHeaderRow(Sheet sheet) {
        if (HEADERS.getFirst().equals(value(sheet.getRow(0), 0))) return 0;
        boolean hasLessonFields = LESSON_HEADERS.getFirst().equals(value(sheet.getRow(1), 0));
        boolean hasTranscriptHeader = HEADERS.getFirst().equals(value(sheet.getRow(TRANSCRIPT_HEADER_ROW), 0));
        return hasLessonFields || hasTranscriptHeader ? TRANSCRIPT_HEADER_ROW : 0;
    }

    private double durationInSeconds(String value) {
        String normalized = value.replace(',', '.');
        var clock = DURATION_CLOCK.matcher(normalized);
        try {
            double seconds = clock.matches()
                ? Double.parseDouble(clock.group(1)) * 60 + Double.parseDouble(clock.group(2))
                : Double.parseDouble(normalized);
            if (Double.isFinite(seconds) && seconds > 0) return seconds;
        } catch (NumberFormatException invalidDuration) {
            // An empty or nonnumeric cell uses the same message as an invalid duration.
        }
        throw new DictationValidationException("Nhập thời lượng video theo mm:ss (ví dụ 01:30) hoặc bằng số giây lớn hơn 0.");
    }

    private ImportResult transcript(Workbook workbook) {
        List<ImportIssue> errors = new ArrayList<>();
        List<Sentence> sentences = new ArrayList<>();
        Sheet sheet = workbook.getSheet("Transcript");
        if (sheet == null) return new ImportResult(
            List.of(),
            List.of(new ImportIssue(1, "Không tìm thấy sheet Transcript."))
        );
        int headerRow = transcriptHeaderRow(sheet);
        for (int col = 0; col < HEADERS.size(); col++) {
            if (!HEADERS.get(col).equals(value(sheet.getRow(headerRow), col))) errors.add(
                new ImportIssue(headerRow + 1, "Tên cột phải là: " + String.join(", ", HEADERS))
            );
        }
        if (!errors.isEmpty()) return new ImportResult(List.of(), errors);
        if (sheet.getLastRowNum() - headerRow > 1000) throw new DictationValidationException(
            "File chứa quá nhiều dòng. Tối đa 200 câu."
        );
        for (int index = headerRow + 1; index <= sheet.getLastRowNum(); index++) {
            Row row = sheet.getRow(index);
            String order = value(row, 0),
                text = value(row, 1),
                start = value(row, 2),
                end = value(row, 3);
            if ((order + text + start + end).isBlank()) continue;
            if (sentences.size() >= 200) throw new DictationValidationException(
                "Tối đa 200 câu trong một bài."
            );
            int number = index + 1;
            if (!order.equals(Integer.toString(sentences.size() + 1))) errors.add(
                new ImportIssue(number, "Thứ tự phải liên tiếp từ 1.")
            );
            if (text.isBlank() || text.length() > 1500) errors.add(
                new ImportIssue(number, "Transcript cần từ 1 đến 1.500 ký tự.")
            );
            Double from = time(start, number, errors),
                to = time(end, number, errors);
            if (from != null && to != null && from >= to) errors.add(
                new ImportIssue(number, "Kết thúc phải sau bắt đầu.")
            );
            sentences.add(new Sentence(text, from, to));
        }
        if (sentences.isEmpty()) errors.add(
            new ImportIssue(headerRow + 2, "Chưa có câu nào trong sheet Transcript.")
        );
        return new ImportResult(sentences, errors);
    }

    private String value(Row row, int col) {
        if (row == null || row.getCell(col) == null) return "";
        Cell cell = row.getCell(col);
        if (
            cell.getCellType() == CellType.FORMULA || cell.getCellType() == CellType.ERROR
        ) throw new DictationValidationException(
            "Dòng " + (row.getRowNum() + 1) + ": không dùng công thức hoặc ô lỗi."
        );
        return new DataFormatter(Locale.ROOT).formatCellValue(cell).strip();
    }

    private Double time(String text, int row, List<ImportIssue> errors) {
        if (text.isBlank()) return null;
        var clock = TRANSCRIPT_CLOCK.matcher(text);
        if (!clock.matches()) {
            errors.add(new ImportIssue(row, "Thời gian dùng mm:ss, ví dụ 00:02; định dạng ô là văn bản."));
            return null;
        }
        return BigDecimal.valueOf(Long.parseLong(clock.group(1)) * 60)
            .add(new BigDecimal(clock.group(2))).doubleValue();
    }
}
