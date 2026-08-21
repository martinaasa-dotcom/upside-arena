import { LegalPage } from "@/components/LegalPage";
import { MINIMUM_AGE, PRIVACY_VERSION } from "@/lib/legal";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" version={PRIVACY_VERSION}>
      <p>
        This explains what Upside Arena collects, why, and what you can ask us
        to do about it. We collect as little as the game needs.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account.</strong> Your email address, and your name and
          picture if you sign in with Google.
        </li>
        <li>
          <strong>Your profile.</strong> The name and player tag you choose, and
          the date you confirmed you are {MINIMUM_AGE} or older.
        </li>
        <li>
          <strong>Your game history.</strong> Your trades, your scores, your
          leagues and your streak.
        </li>
        <li>
          <strong>How the app is used.</strong> Which screens are opened and how
          quickly pages load, so we can find what is slow or broken. Sign-in
          cookies always run. Anything beyond that is optional and you can turn
          it down.
        </li>
      </ul>
      <p>We do not sell your data, and we do not run ads.</p>

      <h2>Why we hold it</h2>
      <p>
        To run your account, to score the game, to show other players in your
        league who you are, to keep the game fair, and to answer you when you
        contact us.
      </p>

      <h2>Who else sees it</h2>
      <ul>
        <li>
          <strong>Other players.</strong> Your name, player tag, picture and
          scores in a league you have joined.
        </li>
        <li>
          <strong>Companies that run parts of the service</strong>, such as our
          hosting and database provider, our email sender and our market data
          provider. They may only use it to do that work for us.
        </li>
        <li>
          <strong>Anyone the law requires</strong>, if we are legally obliged to
          hand something over.
        </li>
      </ul>

      <h2>What you can ask for</h2>
      <ul>
        <li>A copy of everything we hold about you, from your profile page.</li>
        <li>A correction, if something is wrong.</li>
        <li>
          Deletion of your account and its data, from your profile page. It goes
          straight away and cannot be undone.
        </li>
        <li>
          To object to how we use something, or to complain to your local data
          protection authority.
        </li>
      </ul>
      <p>
        You do not have to give a reason, and we will never treat you worse for
        asking.
      </p>

      <h2>How long we keep it</h2>
      <p>
        While your account is open. When you close it, your profile and game
        history are erased. We may keep a minimal record of the closure where
        the law requires it.
      </p>

      <h2>Children</h2>
      <p>
        Arena is for people {MINIMUM_AGE} and older. We do not knowingly collect
        anything from anyone younger. If you believe we have, email us and we
        will erase it.
      </p>

      <h2>Where your data lives</h2>
      <p>
        Our providers may store data outside your country. When they do, they
        are required to protect it to the standard your data protection law
        expects.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we will tell you in the
        app before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        Email app.support@upthink.ee with anything at all, including a request
        to see, correct or erase your data.
      </p>
    </LegalPage>
  );
}
