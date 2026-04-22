import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { ProductOverview } from "@/components/ProductOverview";
import { HowItWorks } from "@/components/HowItWorks";
import { WhyItMatters } from "@/components/WhyItMatters";
import { Nomly } from "@/components/Nomly";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProductOverview />
        <HowItWorks />
        <WhyItMatters />
        <Nomly />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
