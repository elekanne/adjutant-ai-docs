import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const products = [
  {
    name: 'Adjutant AI',
    to: '/adjutant-ai/',
    text: 'Install, configure and operate the agentic AI platform that runs entirely inside your Splunk deployment.',
  },
  {
    name: 'Adjutant AI Domain Workspace',
    to: '/domain-workspace/',
    text: 'Set up and use Domain Workspace alongside Adjutant AI.',
  },
];

export default function Home() {
  return (
    <Layout
      title="Documentation"
      description="Documentation for Adjutant AI and Adjutant AI Domain Workspace">
      <main className={styles.main}>
        <h1 className={styles.title}>Documentation</h1>
        <p className={styles.lead}>
          Pick a product to get started. Each product has its own version selector in the top bar.
        </p>
        <div className={styles.products}>
          {products.map((p) => (
            <Link key={p.to} to={p.to} className={styles.product}>
              <h2>{p.name}</h2>
              <p>{p.text}</p>
            </Link>
          ))}
        </div>
      </main>
    </Layout>
  );
}
