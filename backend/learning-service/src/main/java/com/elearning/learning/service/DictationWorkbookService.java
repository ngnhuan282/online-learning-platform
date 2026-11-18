package com.elearning.learning.service;

import com.elearning.learning.common.exception.DictationValidationException;
import com.elearning.learning.dto.DictationModels.*;
import java.io.*;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DictationWorkbookService {

    private static final List<String> HEADERS = List.of("Thứ tự", "Transcript", "Bắt đầu", "Kết thúc");

    public byte[] template() {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            Sheet input = workbook.createSheet("Transcript");
            header(workbook, input, HEADERS);
            input.createFreezePane(0, 1);
            input.setAutoFilter(new CellRangeAddress(0, 200, 0, 3));
            CellStyle text = workbook.createCellStyle();
            text.setDataFormat(workbook.createDataFormat().getFormat("@"));
            for (int index = 1; index <= 200; index++) {
                Row row = input.createRow(index);
                for (int column = 0; column < 4; column++) row.createCell(column).setCellStyle(text);
            }
            String[][] sampleRows = {
                { "1", "Thank you for joining us today.", "00:00", "00:04" },
                { "2", "We will begin in a moment.", "00:04", "00:08" },
            };
            for (int index = 0; index < sampleRows.length; index++) {
                Row row = input.getRow(index + 1);
                for (int column = 0; column < 4; column++) row.getCell(column).setCellValue(
                    sampleRows[index][column]
                );
            }
            input.setColumnWidth(0, 12 * 256);
            input.setColumnWidth(1, 80 * 256);
            input.setColumnWidth(2, 16 * 256);
            input.setColumnWidth(3, 16 * 256);
            Sheet help = workbook.createSheet("Hướng dẫn");
            header(workbook, help, List.of("Cột / ví dụ", "Nội dung", "Bắt đầu", "Kết thúc"));
            String[][] examples = {
                { "Thứ tự", "Nhập số liên tiếp từ 1; mỗi dòng là một câu nghe.", "", "" },
                {
                    "Transcript",
                    "Nhập đúng nội dung tiếng Anh trong audio, không thêm số câu hay tên người nói.",
                    "",
                    "",
                },
                {
                    "Thời gian",
                    "Dùng mm:ss. Có thể để trống rồi đánh dấu bằng audio trên web.",
                    "00:02",
                    "00:06",
                },
                { "Ví dụ 1", "Thank you for joining us today.", "00:00", "00:04" },
                { "Ví dụ 2", "We will begin in a moment.", "00:04", "00:08" },
                {
                    "Lưu ý",
                    "Chỉ sheet Transcript được nhập. Thay hoặc xóa 2 dòng ví dụ trong sheet Transcript trước khi nhập bài của bạn.",
                    "",
                    "",
                },
                {
                    "Xuất bản",
                    "Cần đủ mốc bắt đầu/kết thúc, đúng thứ tự, không chồng lấn. Mốc kết thúc vượt thời lượng sẽ lấy đến cuối audio.",
                    "",
                    "",
                },
                {
                    "Giới hạn",
                    "Tối đa 200 câu; 1.500 ký tự/câu. Không dùng công thức Excel hoặc đổi tên cột.",
                    "",
                    "",
                },
            };
            for (int i = 0; i < examples.length; i++) {
                Row row = help.createRow(i + 1);
                for (int c = 0; c < 4; c++) row.createCell(c).setCellValue(examples[i][c]);
            }
            help.setColumnWidth(0, 20 * 256);
            help.setColumnWidth(1, 110 * 256);
            help.setColumnWidth(2, 16 * 256);
            help.setColumnWidth(3, 16 * 256);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot generate transcript template", ex);
        }
    }

    public ImportResult parse(MultipartFile file) {
        if (
            file.isEmpty() ||
            file.getSize() > 5L * 1024 * 1024 ||
            file.getOriginalFilename() == null ||
            !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx")
        ) throw new DictationValidationException("Vui lòng chọn file Excel .xlsx không quá 5 MB.");
        List<ImportIssue> errors = new ArrayList<>();
        List<Sentence> sentences = new ArrayList<>();
        try (var workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheet("Transcript");
            if (sheet == null) return new ImportResult(
                List.of(),
                List.of(new ImportIssue(1, "Không tìm thấy sheet Transcript."))
            );
            for (int col = 0; col < HEADERS.size(); col++) {
                if (!HEADERS.get(col).equals(value(sheet.getRow(0), col))) errors.add(
                    new ImportIssue(1, "Tên cột phải là: " + String.join(", ", HEADERS))
                );
            }
            if (!errors.isEmpty()) return new ImportResult(List.of(), errors);
            if (sheet.getLastRowNum() > 1000) throw new DictationValidationException(
                "File chứa quá nhiều dòng. Tối đa 200 câu."
            );
            for (int index = 1; index <= sheet.getLastRowNum(); index++) {
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
                new ImportIssue(2, "Chưa có câu nào trong sheet Transcript.")
            );
            return new ImportResult(sentences, errors);
        } catch (DictationValidationException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new DictationValidationException(
                "Không đọc được file. Hãy dùng file Excel mẫu và không nhập công thức."
            );
        }
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
        if (!text.matches("[0-9]{2,3}:[0-5][0-9]")) {
            errors.add(new ImportIssue(row, "Thời gian dùng mm:ss, ví dụ 00:02; định dạng ô là văn bản."));
            return null;
        }
        String[] parts = text.split(":");
        return Double.parseDouble(parts[0]) * 60 + Double.parseDouble(parts[1]);
    }

    private void header(Workbook workbook, Sheet sheet, List<String> names) {
        Row row = sheet.createRow(0);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        CellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        for (int i = 0; i < names.size(); i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(names.get(i));
            cell.setCellStyle(style);
        }
    }
}
