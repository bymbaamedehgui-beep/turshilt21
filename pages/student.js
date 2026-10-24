import Head from 'next/head';
import StudentApp from '../components/StudentPortal';

// Сурагчийн хэсэг: багшийн өгсөн кодоор нэвтэрнэ
export default function StudentPage() {
  return (
    <>
      <Head><title>Сурагчийн хэсэг · ЭЕШ шалгагч</title></Head>
      <StudentApp />
    </>
  );
}
