import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, TrendingUp, Award, Shield, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
export default function LandingPage() {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({
    x: 0,
    y: 0
  });

  // Efeito parallax sutil no mouse
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  return <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Background com gradientes animados */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradiente laranja principal */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[150px] animate-pulse" style={{
        transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`,
        transition: 'transform 0.3s ease-out'
      }} />
        
        {/* Gradiente laranja secundário */}
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-600/15 rounded-full blur-[120px] animate-pulse" style={{
        transform: `translate(${-mousePosition.x}px, ${-mousePosition.y}px)`,
        transition: 'transform 0.3s ease-out',
        animationDelay: '1s'
      }} />

        {/* Grid sutil de fundo */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `
              linear-gradient(hsl(var(--primary) / 0.1) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--primary) / 0.1) 1px, transparent 1px)
            `,
        backgroundSize: '50px 50px'
      }} />
      </div>

      {/* Header */}
      <header className="relative z-10 container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-orange-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            TOP Brasil
          </span>
        </div>
        
        <Button onClick={() => navigate('/login')} variant="outline" className="border-primary/30 text-white hover:bg-primary/10 hover:border-primary transition-all">
          Acessar Painel
        </Button>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 py-20 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge animado */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8 animate-fade-in">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm text-primary font-medium">
              Transforme sua carreira hoje
            </span>
          </div>

          {/* Título principal */}
          <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
            Seja um Consultor de{' '}
            <span className="bg-gradient-to-r from-primary via-orange-500 to-orange-600 bg-clip-text text-transparent animate-gradient">
              Proteção Veicular
            </span>
          </h1>

          {/* Subtítulo */}
          <p className="text-xl lg:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Transforme sua carreira com a TOP Brasil. Ganhe até{' '}
            <span className="text-primary font-semibold">R$ 12.000/mês</span>{' '}
            ajudando pessoas a protegerem seus veículos.
          </p>

          {/* CTA Principal */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" onClick={() => navigate('/login')} className="bg-gradient-to-r from-primary to-orange-600 hover:from-orange-600 hover:to-primary text-white font-semibold px-8 py-6 text-lg rounded-xl shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-105 group">
              Quero Ser Consultor
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <Button size="lg" variant="outline" onClick={() => {
            document.getElementById('beneficios')?.scrollIntoView({
              behavior: 'smooth'
            });
          }} className="border-gray-700 text-white hover:bg-white/5 px-8 py-6 text-lg rounded-xl">
              Saiba Mais
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto">
            <div className="text-center group cursor-default">
              <div className="text-4xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform">
                500+
              </div>
              <div className="text-sm text-gray-400">Consultores Ativos</div>
            </div>
            <div className="text-center group cursor-default">
              <div className="text-4xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform">
                R$ 12k
              </div>
              <div className="text-sm text-gray-400">Ganho Médio/Mês</div>
            </div>
            <div className="text-center group cursor-default">
              <div className="text-4xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform">
                98%
              </div>
              <div className="text-sm text-gray-400">Satisfação</div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios Section */}
      <section id="beneficios" className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">
            Por que escolher a{' '}
            <span className="text-primary">TOP Brasil</span>?
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="group relative bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-primary/50 transition-all hover:scale-105 cursor-default">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Rede de Consultores</h3>
                <p className="text-gray-400 text-sm">
                  Faça parte de uma rede nacional de sucesso
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group relative bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-primary/50 transition-all hover:scale-105 cursor-default">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Alta Rentabilidade</h3>
                <p className="text-gray-400 text-sm">
                  Ganhe até R$ 12.000/mês com comissões
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="group relative bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-primary/50 transition-all hover:scale-105 cursor-default">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Award className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Ranking & Gamificação</h3>
                <p className="text-gray-400 text-sm">
                  Compete e seja reconhecido pelos resultados
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="group relative bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-primary/50 transition-all hover:scale-105 cursor-default">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Suporte Completo</h3>
                <p className="text-gray-400 text-sm">
                  Treinamento e ferramentas profissionais
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-gray-900 to-black border border-primary/30 rounded-3xl p-12 text-center overflow-hidden">
            {/* Background decorativo */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            
            <div className="relative">
              <h2 className="text-4xl font-bold mb-4">
                Pronto para Transformar sua Vida?
              </h2>
              <p className="text-xl text-gray-400 mb-8">
                Entre em contato com um de nossos consultores e descubra como você pode fazer parte da TOP Brasil.
              </p>
              <Button size="lg" onClick={() => navigate('/login')} className="bg-gradient-to-r from-primary to-orange-600 hover:from-orange-600 hover:to-primary text-white font-semibold px-12 py-6 text-lg rounded-xl shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-105">
                Acessar Painel de Consultor
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-900 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          © 2026 TOP Brasil - Todos os direitos reservados
        </div>
      </footer>

      {/* CSS para animação do gradiente */}
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>;
}