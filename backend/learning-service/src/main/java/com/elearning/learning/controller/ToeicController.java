package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.ToeicModels.*;
import com.elearning.learning.service.ToeicDictionaryService;
import com.elearning.learning.service.ToeicNoteService;
import com.elearning.learning.service.ToeicService;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/toeic")
public class ToeicController {

    private final ToeicService toeic;
    private final ToeicNoteService notes;
    private final ToeicDictionaryService dictionary;

    public ToeicController(ToeicService toeic, ToeicNoteService notes, ToeicDictionaryService dictionary) {
        this.toeic = toeic;
        this.notes = notes;
        this.dictionary = dictionary;
    }

    @GetMapping("/exams")
    public ApiResponse<List<Summary>> catalog() {
        return ApiResponse.success(toeic.catalog());
    }

    @GetMapping("/dictionary")
    public ApiResponse<DictionaryEntry> dictionary(@RequestParam(defaultValue = "") String term) {
        return ApiResponse.success(dictionary.lookup(term));
    }

    @GetMapping("/notes")
    public ApiResponse<NotesCollection> listNotes(
        Principal user,
        @RequestParam(required = false) Long examId
    ) {
        return ApiResponse.success(notes.list(id(user), examId));
    }

    @PostMapping("/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<NoteMutationResult> createNote(Principal user, @RequestBody CreateNoteRequest body) {
        return ApiResponse.success(notes.create(id(user), body));
    }

    @PutMapping("/notes/{noteId}")
    public ApiResponse<NoteMutationResult> updateNote(
        Principal user,
        @PathVariable long noteId,
        @RequestBody UpdateNoteRequest body
    ) {
        return ApiResponse.success(notes.update(id(user), noteId, body));
    }

    @DeleteMapping("/notes/{noteId}")
    public ApiResponse<NotesCollection> deleteNote(Principal user, @PathVariable long noteId) {
        return ApiResponse.success(notes.delete(id(user), noteId));
    }

    @GetMapping("/exams/{examId}")
    public ApiResponse<Detail> detail(@PathVariable long examId) {
        return ApiResponse.success(toeic.detail(examId));
    }

    @GetMapping("/exams/{examId}/progress")
    public ApiResponse<Progress> progress(Principal user, @PathVariable long examId) {
        return ApiResponse.success(toeic.progress(id(user), examId));
    }

    @PutMapping("/exams/{examId}/lessons/{lessonId}/complete")
    public ApiResponse<Progress> complete(
        Principal user,
        @PathVariable long examId,
        @PathVariable String lessonId
    ) {
        return ApiResponse.success(toeic.completeLesson(id(user), examId, lessonId));
    }

    @PostMapping("/exams/{examId}/attempts")
    public ApiResponse<AttemptView> start(
        Principal user,
        @PathVariable long examId,
        @RequestBody StartRequest body
    ) {
        return ApiResponse.success(toeic.start(id(user), examId, body));
    }

    @GetMapping("/attempts/{attemptId}")
    public ApiResponse<AttemptView> attempt(Principal user, @PathVariable long attemptId) {
        return ApiResponse.success(toeic.getAttempt(id(user), attemptId));
    }

    @PutMapping("/attempts/{attemptId}/answers")
    public ApiResponse<AttemptView> save(
        Principal user,
        @PathVariable long attemptId,
        @RequestBody AnswersRequest body
    ) {
        return ApiResponse.success(toeic.saveAnswers(id(user), attemptId, body));
    }

    @PostMapping("/attempts/{attemptId}/submit")
    public ApiResponse<AttemptView> submit(
        Principal user,
        @PathVariable long attemptId,
        @RequestBody AnswersRequest body
    ) {
        return ApiResponse.success(toeic.submit(id(user), attemptId, body));
    }

    private long id(Principal user) {
        return Long.parseLong(user.getName());
    }
}
