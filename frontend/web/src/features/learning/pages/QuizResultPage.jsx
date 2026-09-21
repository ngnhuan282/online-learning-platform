import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import LearningNotice from '../components/LearningNotice';
import ProgressBar from '../components/ProgressBar';
import { learningApi } from '../api/learningApi';
import { demoQuizResult } from '../data/learningDemoData';
import useLearningResource from '../hooks/useLearningResource';

export default function QuizResultPage() {
  const { quizId } = useParams();
  const loadResult = useCallback(() => learningApi.getQuizResult(quizId), [quizId]);
  const { data, error, loading, usingFallback } = useLearningResource(
    loadResult,
    demoQuizResult,
  );

  return (
    <section className="learning-page">
      <div className="learning-shell quiz-result-shell" aria-busy={loading}>
        <div className="learning-page-header">
          <div>
            <p>Quiz Result</p>
            <h1>Kết quả Quiz #{quizId}</h1>
          </div>
          <Link className="button button-outline" to={`/learning/${data.courseId}`}>
            Quay lại bài học
          </Link>
        </div>

        <LearningNotice error={error} usingFallback={usingFallback} />

        <article className="quiz-result-card">
          <span className={`learning-chip ${data.passed ? 'is-success' : 'is-warning'}`}>
            {data.passed ? 'Đạt' : 'Cần luyện thêm'}
          </span>
          <strong>{data.score ?? 0}%</strong>
          <ProgressBar value={data.score ?? 0} />
          <p>Attempt #{data.attemptId} · {data.status}</p>
        </article>
      </div>
    </section>
  );
}
