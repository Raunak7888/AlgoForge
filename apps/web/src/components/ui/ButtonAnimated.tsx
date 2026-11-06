import Link from "next/link";

const CLASS = `
  relative inline-block px-[2em] py-[1em] text-[15px] font-bold uppercase tracking-[5px] text-accent text-center
  outline outline-2 outline-accent border-none rounded-full cursor-pointer overflow-hidden
  transition-all duration-1000 z-10
  hover:text-white hover:scale-110 hover:outline-accent hover:shadow-[4px_5px_17px_-4px_accent]
  before:content-[''] before:absolute before:top-0 before:-left-[50px] before:w-0 before:h-full
  before:bg-accent before:skew-x-[45deg] before:-z-10 before:transition-[width] before:duration-1000
  hover:before:w-[250%]
`;

const AnimatedButton = ({ text, href }: { text: string; href?: string }) => (
    <div className="flex items-center justify-center p-8">
        {href ? (
            <Link href={href} className={CLASS}>{text}</Link>
        ) : (
            <button type="button" className={CLASS}>{text}</button>
        )}
    </div>
);

export default AnimatedButton;
