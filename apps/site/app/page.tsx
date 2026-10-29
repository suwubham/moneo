import { Interactions } from "./_components/interactions";
import { Nav } from "./_components/nav";
import { Ask } from "./_components/sections/ask";
import { Data } from "./_components/sections/data";
import { Features } from "./_components/sections/features";
import { Footer } from "./_components/sections/footer";
import { Hero } from "./_components/sections/hero";
import { Marquee } from "./_components/sections/marquee";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="overflow-x-clip">
        <Hero />
        <Features />
        <Marquee />
        <Ask />
        <Data />
      </main>
      <Footer />
      <Interactions />
    </>
  );
}
