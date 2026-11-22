package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.DictationModels.AdminDetail;
import com.elearning.learning.dto.DictationModels.PublishRequest;
import com.elearning.learning.dto.DictationModels.SaveRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class DictationAdminPublication {

    private final DictationService dictation;
    private final DictationWorkbookSync workbooks;

    public DictationAdminPublication(DictationService dictation, DictationWorkbookSync workbooks) {
        this.dictation = dictation;
        this.workbooks = workbooks;
    }

    @Transactional
    public AdminDetail publish(String id, PublishRequest request) {
        AdminDetail result = request.definition() == null
            ? dictation.publish(id, request.version())
            : dictation.saveAndPublish(id, new SaveRequest(request.definition(), request.version()));
        workbooks.request(result.id(), result.definition().video() == null ? null : result.version());
        syncAfterCommit(result.id());
        return result;
    }

    @Transactional
    public AdminDetail visibility(String id, boolean archived) {
        return dictation.visibility(id, archived);
    }

    @Transactional(readOnly = true)
    public byte[] download(String id) {
        Integer version = dictation.publishedVideoVersion(id);
        if (version == null || dictation.adminDetail(id).archived()) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        return workbooks.download(id, version);
    }

    private void syncAfterCommit(String id) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    workbooks.syncNow(id);
                }
            });
        } else {
            workbooks.syncNow(id);
        }
    }
}
