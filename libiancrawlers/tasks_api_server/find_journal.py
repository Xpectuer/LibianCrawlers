def find_journal():
    import pybliometrics

    pybliometrics.init()  # read API keys

    # Document-specific information

    from pybliometrics.scopus import AbstractRetrieval
    ab = AbstractRetrieval("10.1016/j.softx.2019.100263")
    print(ab)


if __name__ == '__main__':
    find_journal()
