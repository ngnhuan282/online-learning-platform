package com.elearning.learning.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.elearning.learning.dto.ToeicModels.Definition;
import com.elearning.learning.service.ToeicService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.DefaultApplicationArguments;
import tools.jackson.databind.json.JsonMapper;

class ToeicSeedConfigTests {

    @Test
    void startupLoadsBothBundledCollectionsAndUsesTheIdempotentSeedOperationOnRestart() throws Exception {
        ToeicService toeic = mock(ToeicService.class);
        var runner = new ToeicSeedConfig().seedToeicCollections(toeic, JsonMapper.builder().build());
        var arguments = new DefaultApplicationArguments(new String[0]);
        runner.run(arguments);
        var definitions = ArgumentCaptor.forClass(Definition.class);
        verify(toeic, times(19)).seed(definitions.capture());
        var firstRun = definitions.getAllValues();
        assertThat(firstRun).extracting(Definition::slug).doesNotHaveDuplicates();
        assertThat(firstRun).allSatisfy(definition -> assertThat(definition.questions()).isNotEmpty());
        assertThat(
            firstRun.stream().filter(definition -> definition.questions().getFirst().part() <= 4)
        ).hasSize(9);
        assertThat(
            firstRun.stream().filter(definition -> definition.questions().getFirst().part() >= 5)
        ).hasSize(10);

        runner.run(arguments);
        var repeated = ArgumentCaptor.forClass(Definition.class);
        verify(toeic, times(38)).seed(repeated.capture());
        assertThat(repeated.getAllValues().subList(19, 38)).isEqualTo(firstRun);
    }
}
