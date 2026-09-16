import HeroSection from '../features/home/components/HeroSection';
import CategorySection from '../features/home/components/CategorySection';
import FeaturedCourses from '../features/courses/components/FeaturedCourses';
import BenefitsSection from '../features/home/components/BenefitsSection';
import AiTutorSection from '../features/ai-assistant/components/AiTutorSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <CategorySection />
      <FeaturedCourses />
      <BenefitsSection />
      <AiTutorSection />
    </>
  );
}
