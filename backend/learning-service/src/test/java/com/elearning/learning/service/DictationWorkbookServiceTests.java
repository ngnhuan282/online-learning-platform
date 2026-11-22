package com.elearning.learning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class DictationWorkbookServiceTests {

    private final DictationWorkbookService service = new DictationWorkbookService();

    @Test
    void importsTheLegacyWorkbookWithSeparateLessonAndTranscriptSheets() throws Exception {
        try (var workbook = new XSSFWorkbook()) {
            var metadata = workbook.createSheet("Bài nghe");
            cells(
                metadata.createRow(0),
                "Tên bài nghe",
                "Chủ đề",
                "Trình độ",
                "Link YouTube",
                "Thời lượng (mm:ss)"
            );
            cells(
                metadata.createRow(1),
                "Train departures",
                "Travel",
                "B1",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "01:30"
            );
            var transcript = workbook.createSheet("Transcript");
            cells(transcript.createRow(0), "Thứ tự", "Transcript", "Bắt đầu", "Kết thúc");
            cells(transcript.createRow(1), "1", "The train departs soon.", "00:05", "00:08");

            var lesson = service.parseLesson(write(workbook));

            assertThat(lesson.title()).isEqualTo("Train departures");
            assertThat(lesson.topic()).isEqualTo("Travel");
            assertThat(lesson.video().duration()).isEqualTo(90);
            assertThat(lesson.sentences())
                .singleElement()
                .satisfies(sentence -> {
                    assertThat(sentence.text()).isEqualTo("The train departs soon.");
                    assertThat(sentence.start()).isEqualTo(5);
                    assertThat(sentence.end()).isEqualTo(8);
                });
        }
    }

    @Test
    void rejectsUnreadableWorkbookAndReportsMissingTranscriptSheet() throws Exception {
        assertThatThrownBy(() ->
            service.parse(upload("transcript.csv", new byte[] { 1 }))
        ).hasMessageContaining(".xlsx");
        assertThatThrownBy(() ->
            service.parse(upload("transcript.xlsx", new byte[] { 1 }))
        ).hasMessageContaining("Không đọc được file");
        try (var workbook = new XSSFWorkbook()) {
            workbook.createSheet("Notes");
            var result = service.parse(upload("transcript.xlsx", write(workbook)));

            assertThat(result.sentences()).isEmpty();
            assertThat(result.errors())
                .singleElement()
                .satisfies(error -> {
                    assertThat(error.row()).isEqualTo(1);
                    assertThat(error.message()).contains("Không tìm thấy sheet Transcript");
                });
        }
    }

    private static void cells(Row row, String... values) {
        for (int column = 0; column < values.length; column++) row.createCell(column).setCellValue(
            values[column]
        );
    }

    private static byte[] write(XSSFWorkbook workbook) throws Exception {
        try (var out = new ByteArrayOutputStream()) {
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private static MockMultipartFile upload(String name, byte[] contents) {
        return new MockMultipartFile("file", name, "application/octet-stream", contents);
    }
}
